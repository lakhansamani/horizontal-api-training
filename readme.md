# Express server

## Running postgres

```sh
docker run --name postgres-cluster -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```


## Table creation


```sql
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid (),
    email VARCHAR NOT NULL UNIQUE,
   	password VARCHAR NOT NULL,
    PRIMARY KEY (id)
);
```