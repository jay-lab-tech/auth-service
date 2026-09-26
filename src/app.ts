import express from 'express';
import helmet from 'helmet';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_request, response) => {
  response.status(200).json({ data: { status: 'ok' } });
});
