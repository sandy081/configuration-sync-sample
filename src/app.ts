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
	app.use(bodyParser.text());

	const router = express.Router();
	router.get('*', async (req, res) => {
		const key = req.path.substring(1);
		if (!key) {
			res.sendStatus(400);
			return;
		}
		try {
			const { content, ref } = await read(key, req);
			res.setHeader('ETag', ref);
			res.send(content ? new Buffer(content) : content);
		} catch (e) {
			if (e instanceof HttpStatusError) {
				res.sendStatus(e.status);
			} else {
				res.sendStatus(500);
			}
		}

	});
	router.post('*', async (req, res) => {
		const key = req.path.substring(1);
		if (!key || !req.body) {
			res.sendStatus(400);
		}
		const content = req.body;
		try {
			const result = await write(key, content, req);
			res.setHeader('ETag', result);
			res.sendStatus(200);
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

const userDataSyncStorePath = '/Users/sandy081/work/testing/remote-user-data-store';

async function read(key: string, req: express.Request): Promise<{ content?: string, ref: string }> {
	const directory = join(userDataSyncStorePath, key);
	const ifNoneMatchRef = req.headers['if-none-match'];
	const ref = await getRef(directory);
	if (ref === ifNoneMatchRef) {
		throw new HttpStatusError('Not Modified', 304);
	}
	if (ref !== '0') {
		const content = await promisify(fs.readFile)(join(directory, ref));
		return { ref, content: content.toString() };
	}
	return { ref: '0' };
}

async function write(key: string, content: string, req: express.Request): Promise<string> {
	const directory = join(userDataSyncStorePath, key);
	await createDir(directory);
	const latestRef = await getRef(directory);
	const ifMatchRef = req.headers['if-match'];
	if (ifMatchRef && ifMatchRef !== latestRef) {
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

async function getRef(directory: string): Promise<string> {
	if (await promisify(fs.exists)(directory)) {
		const children = await promisify(fs.readdir)(directory);
		if (children.length) {
			children.sort((a, b) => Number(b) - Number(a));
			return children[0];
		}
	}
	return '0';
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