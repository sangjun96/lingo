import { routeAgentRequest } from 'agents';

export { LingoAgent } from './agents/lingo';

export default {
  async fetch(request, env) {
    return await routeAgentRequest(request, env)
      ?? Response.json({ error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
