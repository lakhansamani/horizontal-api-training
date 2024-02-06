// src/index.js
import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
const stripe = require('stripe')(
  'sk_test_51OgcQ6IDnGcng56mwTHuEBeIxKZnxXOsqjAHnirRP4Ov81ESel7HCrdsDN1JmTxM1sMz0OHmbCelKKeiuUHETIWW002HyaZ7kf'
);
// This example sets up an endpoint using the Express framework.
// Watch this video to get started: https://youtu.be/rPR2aJ6XnAc.

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
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }
  sql`
        select * from users where email = ${email}
    `
    .then((users) => {
      if (users.length === 0) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }
      const user = users[0];
      bcrypt.compare(password, user.password, function (err, result) {
        if (err) {
          console.error('failed to compare password', err);
          res.status(500).json({ message: 'Internal Server Error' });
        }
        // generate jwt token using jsonwebtoken
        const privateKey = process.env.PRIVATE_KEY || '';
        // sign with RSA SHA256

        const token = jwt.sign(
          {
            email,
            id: user.id,
            sub: user.id,
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
          res.status(401).json({ message: 'Invalid email or password' });
          return;
        }
      });
    })
    .catch((err) => {
      console.error('failed to query for user', err);
      res.status(500).json({ message: 'Internal Server Error' });
    });
});

app.post('/payment-sheet', async (req, res) => {
  // Use an existing Customer ID if this is a returning customer.
  const customer = {
    id: 'cus_PVdjF7Nyyonj2V',
  };
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2023-10-16' }
  );
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1099,
    currency: 'usd',
    customer: customer.id,
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter
    // is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.json({
    paymentIntent: paymentIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customer: customer.id,
    publishableKey:
      'pk_test_51ORsjESAtWZWvbEwA0ibtP9vtCmSJx6sd8MMcERH3giCxRalbEl7LYfv2dBZLIKfhmVPloOy8miZZCdrjQRlL5Hp00OXyJ3AcQ',
  });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
