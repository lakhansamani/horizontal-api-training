// src/index.js
import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;
const sql = postgres(process.env.DATABASE_URL || '');

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server');
});

app.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).send('Email and password are required');
  }
  bcrypt.hash(password, 10, async function (err, hash) {
    // Store hash in your password DB.
    if (err) {
      console.error('failed to hash password', err);
      res.status(500).send('Internal Server Error');
    }
    const user = await sql`
      insert into users
        (email, password)
      values
        (${email}, ${hash})
      returning email, password
    `;
    res.json({
      message: 'User created successfully',
    });
  });
});

app.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).send('Email and password are required');
  }
  sql`
        select * from users where email = ${email}
    `
    .then((users) => {
      if (users.length === 0) {
        res.status(401).send('Invalid email or password');
      }
      const user = users[0];
      bcrypt.compare(password, user.password, function (err, result) {
        if (err) {
          console.error('failed to compare password', err);
          res.status(500).send('Internal Server Error');
        }
        // generate jwt token using jsonwebtoken
        const privateKey = process.env.PRIVATE_KEY || '';
        // sign with RSA SHA256

        const token = jwt.sign(
          {
            email,
            id: user.id,
            sub: user.id,
            iat: Date.now(),
            'https://hasura.io/jwt/claims': {
              'x-hasura-default-role': 'user',
              'x-hasura-allowed-roles': ['user', 'admin'],
              'x-hasura-user-id': user.id,
            },
          },
          privateKey,
          {
            algorithm: 'RS256',
            expiresIn: '250h',
          }
        );
        if (result) {
          res.json({
            token,
            email,
            id: user.id,
            message: 'User logged in successfully',
          });
        } else {
          res.status(401).send('Invalid email or password');
        }
      });
    })
    .catch((err) => {
      console.error('failed to query for user', err);
      res.status(500).send('Internal Server Error');
    });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
