import { KvCacheGetOptions, KvCachePutOptions, Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from '../utils/raindrop.gen';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserInput } from '../models/user.model';
import { KVHelpers } from '../utils/kv-helpers';

const app = new Hono<{ Bindings: Env }>();
app.use('*', logger());

app.get('/api/user/:id', async (c) => {
  try {
    // const id = c.req.param('id');
    // const userRepository = new UserRepository(c.env.KV_CACHE);
    // const user = await userRepository.getUser(id);
    // return c.json({
    //   success: true,
    //   id,
    //   user
    // });
    const key = c.req.param('id');
    const cache = c.env.KV_CACHE;

    const getOptions: KvCacheGetOptions<'json'> = {
      type: 'json'
    };

    const value = await cache.get(key, getOptions);

    if (value === null) {
      return c.json({ error: 'Key not found in cache' }, 404);
    }

    return c.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    return c.json({
      error: 'Get user failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// app.post('/api/user', async (c) => {
//   try {
//     const userRepository = new UserRepository(c.env.KV_CACHE);
//     const userInput = await c.req.json() as CreateUserInput;
//     const user = await userRepository.createUser(userInput);
//     return c.json({
//       success: true,
//       message: 'Create user successfully',
//       user
//     });
//   } catch (error) {
//     return c.json({
//       error: 'Create user failed',
//       message: error instanceof Error ? error.message : 'Unknown error'
//     }, 500);
//   }
// });

app.post('/api/cache', async (c) => {
  try {
    const { key, value, ttl } = await c.req.json();

    if (!key || value === undefined) {
      return c.json({ error: 'key and value are required' }, 400);
    }

    const cache = c.env.KV_CACHE;

    const putOptions: KvCachePutOptions = {};
    if (ttl) {
      putOptions.expirationTtl = ttl;
    }

    await cache.put(key, JSON.stringify(value), putOptions);

    return c.json({
      success: true,
      message: 'Data cached successfully',
      key
    });
  } catch (error) {
    return c.json({
      error: 'Cache put failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});


app.get('/api/cache/list/:key', async (c) => {
  try {
    const kvHelper = new KVHelpers(c.env.KV_CACHE);
    const key =  c.req.param('key');
    const result = await kvHelper.listKeys(key);
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    return c.json({
      error: 'Get key failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.delete('/api/cache/:key', async(c) => {
   try {
    const kvHelper = new KVHelpers(c.env.KV_CACHE);
    const key =  c.req.param('key');
    const result = await kvHelper.deleteByPrefix(key);
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    return c.json({
      error: 'delete key failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});



export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}

