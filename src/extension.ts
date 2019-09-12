import * as vscode from 'vscode';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

export async function activate(context: vscode.ExtensionContext) {

	vscode.window.registerUserDataProvider('Local Store', {
		async read(key: string): Promise<{ content: string, ref: string } | null> {
			const path = await getPath();
			if (!path) {
				throw new Error('Location on the disk to store user data is not provided.');
			}
			const directory = join(path, key);
			try {
				const ref = await getRef(directory);
				if (ref !== null) {
					const content = await promisify(fs.readFile)(join(directory, ref));
					return { ref, content: content.toString() };
				}
			} catch (e) {
			}
			return null;
		},
		async write(key: string, content: string, ref: string | null): Promise<string> {
			const path = await getPath();
			if (!path) {
				throw new Error('Location on the disk to store user data is not provided.');
			}
			const directory = join(path, key);
			await createDir(directory);
			const latestRef = await getRef(directory);
			if (ref !== latestRef) {
				throw vscode.UserDataError.Rejected();
			}
			const newRef = String(latestRef ? Number(latestRef) + 1 : 1);
			const file = join(directory, newRef);
			if (await promisify(fs.exists)(file)) {
				throw vscode.UserDataError.Rejected();
			}
			await promisify(fs.writeFile)(file, content);
			return newRef;
		}
	});

}

async function getRef(directory: string): Promise<string | null> {
	const children = await promisify(fs.readdir)(directory);
	if (children.length) {
		children.sort((a, b) => Number(b) - Number(a));
		return children[0];
	}
	return null;
}

async function getPath(): Promise<string | null | undefined> {
	const value = vscode.workspace.getConfiguration().get<string>('fsstore.sync.path');
	if (value) {
		return value;
	}

	const result = await vscode.window.showInformationMessage('Please select the location on the disk to sync', 'Select Location...');
	if (!result) {
		return null;
	}

	const locations = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: 'Select folder to store user data',
	});

	if (!locations || !locations.length) {
		return null;
	}

	await vscode.workspace.getConfiguration().update('fsstore.sync.path', locations[0].fsPath, vscode.ConfigurationTarget.Global);
	return vscode.workspace.getConfiguration().get<string>('fsstore.sync.path');
}

async function createDir(path: string): Promise<void> {
	try {
		await promisify(fs.stat)(path);
	} catch (e) {
		await promisify(fs.mkdir)(path);
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }
