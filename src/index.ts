import {Context, Hono, Next} from 'hono'
import { chatCompletions } from './web/aiApiEntry'
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

let ormClient:PrismaClient|null = null;

declare module 'hono' {
  interface ContextVariableMap {
    prisma: PrismaClient
  }
}

export interface Env {
  DB: D1Database;
}

const app = new Hono();

async function prepareDBConnection(c:Context, next:Next){
  if(ormClient == null){
    console.log("prepareDBConnection");
    const adapter = new PrismaD1(c.env.DB);
    ormClient = new PrismaClient({ adapter });
  }

  c.set('prisma', ormClient);

  await next();
}

app.use(prepareDBConnection);

app.get('/', (c) => {
  return c.text('Hello, welcome to serverless ai gateway!')
})

app.get('/testORM.json', async (c) => {

  const prisma = c.get('prisma');
  const users = await prisma.user.findMany();

  const result = JSON.stringify(users);
  return new Response(result);
})

app.post('/v1/chat/completions', chatCompletions);

export default app
