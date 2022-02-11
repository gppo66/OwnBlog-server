import express from 'express';
import mongoose from 'mongoose';
import config from './config';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';

// Routes
import postsRoutes from './routes/api/post';
import userRoutes from './routes/api/user';
import authRoutes from './routes/api/auth';
import searchRoutes from './routes/api/search';

import morgan from 'morgan';
import path from 'path';

const app = express();
const { MONGO_URI } = config;

const prod = process.env.NODE_ENV === 'production';

app.use(hpp());
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// app.use(cors({ origin: true, credentials: true }));
if (prod) {
  app.use(
    cors({
      origin: ['https://jellybear.kr', /\.jellybear\.coms$/],
      credentials: true,
    }),
  );
  app.use(
    cors({
      origin: ['https://www.jellybear.kr', /\.jellybear\.coms$/],
      credentials: true,
    }),
  );
} else {
  app.use(morgan('dev'));
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
}
app.use(express.json());

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => console.log('MONGODB Connecting Success'))
  .catch((e) => console.log(e));

// Use routes
if (prod) {
  app.all('*', (req, res, next) => {
    let protocol = req.headers['x-forward-proto'] || req.protocol;
    if (protocol === 'https') {
      next();
    } else {
      let to = `https://${req.hostname}${req.url}`;
      res.redirect(to);
    }
  });
  //www to non-www
  app.all('/*', function (req, res, next) {
    if (req.headers.host.match(/^www/) !== null) {
      res.redirect(
        'https://' + req.headers.host.replace(/^www\./, '') + req.url,
      );
    } else {
      next();
    }
  });
}
app.use('/api/post', postsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);

if (prod) {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

export default app;
