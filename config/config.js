import { connectToPostgres } from "./postgres.js";

const connectToDatabase = async () => {
  await connectToPostgres();
};

export { connectToDatabase };