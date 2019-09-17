import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import * as express from 'express';
import * as bodyParser from 'body-parser';

class HttpStatusError extends Error {
	constructor(message: string, readonly status: number) {
		super(message);
	}
}

export function createApp(): express.Application {
	const app = express();
	app.use(bodyParser.json());

	const router = express.Router();
	router.get('*', async (req, res) => {
		const key = req.path.substring(1);
		if (!key) {
			res.sendStatus(400);
			return;
		}
		const result = await read(key);
		res.send(new Buffer(JSON.stringify(result)));
	});
	router.post('*', async (req, res) => {
		const key = req.path.substring(1);
		if (!key || !req.body) {
			res.sendStatus(400);
		}
		const { content, ref } = req.body;
		try {
			const result = await write(key, content, ref);
			res.send(result);
		} catch (e) {
			if (e instanceof HttpStatusError) {
				res.sendStatus(e.status);
			} else {
				res.sendStatus(500);
			}
		}
	});
	app.use(router);

	return app;
}

const userDataSyncStorePath = '/Users/sandy081/work/testing/user-data-store';

async function read(key: string): Promise<{ content: string, ref: string } | null> {
	const directory = join(userDataSyncStorePath, key);
	try {
		const ref = await getRef(directory);
		if (ref !== null) {
			const content = await promisify(fs.readFile)(join(directory, ref));
			return { ref, content: content.toString() };
		}
	} catch (e) {
	}
	return null;
}

async function write(key: string, content: string, ref: string): Promise<string> {
	const directory = join(userDataSyncStorePath, key);
	await createDir(directory);
	const latestRef = await getRef(directory);
	if (ref !== latestRef) {
		throw new HttpStatusError('Precondition failed', 412);
	}
	const newRef = String(latestRef ? Number(latestRef) + 1 : 1);
	const file = join(directory, newRef);
	if (await promisify(fs.exists)(file)) {
		throw new HttpStatusError('Precondition failed', 412);
	}
	await promisify(fs.writeFile)(file, content);
	return newRef;
}

async function getRef(directory: string): Promise<string | null> {
	const children = await promisify(fs.readdir)(directory);
	if (children.length) {
		children.sort((a, b) => Number(b) - Number(a));
		return children[0];
	}
	return null;
}

async function createDir(path: string): Promise<void> {
	try {
		await promisify(fs.stat)(path);
	} catch (e) {
		await promisify(fs.mkdir)(path);
	}
}

const server = createApp().listen(process.env.PORT || 3000, () => {
	const { address, port } = server.address();
	const timeout = process.env['timeout'];
	server.timeout = timeout ? parseInt(timeout) : 1000 * 60 * 5;
	console.log('server listening on ' + address + ':' + port);
});