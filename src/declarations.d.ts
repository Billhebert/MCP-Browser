declare module "pg" {
  export class Client {
    constructor(config: { connectionString: string });
    connect(): Promise<void>;
    query(text: string): Promise<{ rows: Record<string, unknown>[] }>;
    end(): Promise<void>;
  }
}

declare module "mysql2/promise" {
  export function createConnection(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): Promise<unknown>;
}
