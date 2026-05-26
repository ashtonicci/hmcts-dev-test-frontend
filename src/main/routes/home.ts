import { Application, Request, Response } from 'express';
import axios from 'axios';
import config from 'config';

function sendAxiosError(res: Response, error: unknown): void {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 502;
    const payload = error.response?.data;

    if (payload) {
      res.status(status).json(payload);
      return;
    }

    res.status(status).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: 'Unexpected server error' });
}

function sendAxiosResponse(res: Response, response: { status: number; data: unknown }): void {
  if (response.status === 204 || response.data === undefined || response.data === null) {
    res.status(response.status).end();
    return;
  }

  res.status(response.status).json(response.data);
}

function pickTaskQueryParams(req: Request): Record<string, unknown> {
  return {
    page: req.query.page,
    size: req.query.size,
    sort: req.query.sort,
  };
}

export default function (app: Application): void {
  const backendUrl = config.get<string>('services.backend.url');

  app.get('/', (_req, res) => {
    res.render('home');
  });

  app.get('/api/tasks', async (req, res) => {
    try {
      const response = await axios.get(`${backendUrl}/tasks`, {
        params: pickTaskQueryParams(req),
      });
      sendAxiosResponse(res, response);
    } catch (error) {
      sendAxiosError(res, error);
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const response = await axios.post(`${backendUrl}/tasks`, req.body);
      sendAxiosResponse(res, response);
    } catch (error) {
      sendAxiosError(res, error);
    }
  });

  app.get('/api/tasks/:id', async (req, res) => {
    try {
      const response = await axios.get(`${backendUrl}/tasks/${req.params.id}`);
      sendAxiosResponse(res, response);
    } catch (error) {
      sendAxiosError(res, error);
    }
  });

  app.patch('/api/tasks/:id/status', async (req, res) => {
    try {
      const response = await axios.patch(`${backendUrl}/tasks/${req.params.id}/status`, req.body);
      sendAxiosResponse(res, response);
    } catch (error) {
      sendAxiosError(res, error);
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const response = await axios.delete(`${backendUrl}/tasks/${req.params.id}`);
      sendAxiosResponse(res, response);
    } catch (error) {
      sendAxiosError(res, error);
    }
  });
}
