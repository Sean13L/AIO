import { Router } from "express";
import { pool } from "../../db/client.js";
import {
  createTodo,
  deleteTodoForUser,
  listTodosForUser,
  updateTodoForUser,
} from "../../db/repositories/todos.js";
import { todoCreateSchema, todoUpdateSchema } from "../validation.js";

export const todosRouter = Router();

todosRouter.get("/todos", async (req, res, next) => {
  try {
    const todos = await listTodosForUser(pool, req.userId!);
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

todosRouter.post("/todos", async (req, res, next) => {
  try {
    const parsed = todoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const todo = await createTodo(pool, req.userId!, parsed.data.title);
    res.status(201).json(todo);
  } catch (err) {
    next(err);
  }
});

todosRouter.patch("/todos/:todoId", async (req, res, next) => {
  try {
    const parsed = todoUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const todo = await updateTodoForUser(pool, req.userId!, req.params.todoId, parsed.data);
    if (!todo) {
      res.status(404).json({ error: "Todo not found" });
      return;
    }
    res.json(todo);
  } catch (err) {
    next(err);
  }
});

todosRouter.delete("/todos/:todoId", async (req, res, next) => {
  try {
    const deleted = await deleteTodoForUser(pool, req.userId!, req.params.todoId);
    if (!deleted) {
      res.status(404).json({ error: "Todo not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
