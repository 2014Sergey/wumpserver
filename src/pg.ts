import {Pool} from 'pg';

// docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=0000 -d postgres:14-alpine
// psql -h localhost -U postgres -f initdb.sql
export const pool = new Pool({
	user: "postgres",
	password: "0000",
	host: "localhost",
	port: 5432
});