import type { Pool, PoolClient } from "pg";

// A lighter, non-syllabus-linked running task list — separate from the
// structured deadline items table. See CLAUDE.md's Organizational Database
// section.
export interface Todo {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export interface TodoUpdate {
  title?: string;
  done?: boolean;
}

export async function listTodosForUser(db: Pool | PoolClient, userId: string): Promise<Todo[]> {
  const result = await db.query<Todo>(
    "SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  return result.rows;
}

export async function createTodo(
  db: Pool | PoolClient,
  userId: string,
  title: string
): Promise<Todo> {
  const result = await db.query<Todo>(
    "INSERT INTO todos (user_id, title) VALUES ($1, $2) RETURNING *",
    [userId, title]
  );
  return result.rows[0];
}

export async function updateTodoForUser(
  db: Pool | PoolClient,
  userId: string,
  todoId: string,
  update: TodoUpdate
): Promise<Todo | null> {
  const fields = Object.keys(update) as (keyof TodoUpdate)[];
  if (fields.length === 0) {
    const existing = await db.query<Todo>(
      "SELECT * FROM todos WHERE id = $1 AND user_id = $2",
      [todoId, userId]
    );
    return existing.rows[0] ?? null;
  }

  const setClauses = fields.map((field, i) => `${field} = $${i + 1}`);
  const values = fields.map((field) => update[field]);

  const result = await db.query<Todo>(
    `UPDATE todos SET ${setClauses.join(", ")}
     WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2}
     RETURNING *`,
    [...values, todoId, userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteTodoForUser(
  db: Pool | PoolClient,
  userId: string,
  todoId: string
): Promise<boolean> {
  const result = await db.query("DELETE FROM todos WHERE id = $1 AND user_id = $2", [
    todoId,
    userId,
  ]);
  return (result.rowCount ?? 0) > 0;
}
