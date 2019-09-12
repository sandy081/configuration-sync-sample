import * as vscode from 'vscode';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

export async function activate(context: vscode.ExtensionContext) {

	vscode.window.registerUserDataProvider('Local Store', {
		async read(key: string): Promise<{ version: number, content: string } | null> {
			const path = await getPath();
			if (!path) {
				throw new Error('Location on the disk to store user data is not provided.');
			}
			const directory = join(path, key);
			try {
				const children = await promisify(fs.readdir)(directory);
				if (children.length) {
					children.sort((a, b) => Number(b) - Number(a));
					const version = Number(children[0]);
					const content = await promisify(fs.readFile)(join(directory, String(version)));
					return { version, content: content.toString() };
				}
			} catch (e) {
			}
			return null;
		},
		async write(key: string, version: number, content: string): Promise<void> {
			const path = await getPath();
			if (!path) {
				throw new Error('Location on the disk to store user data is not provided.');
			}
			const directory = join(path, key);
			await createDir(directory);
			const file = join(directory, String(version));
			if (await promisify(fs.exists)(file)) {
				throw vscode.UserDataError.VersionExists();
			}
			await promisify(fs.writeFile)(file, content);
		}
	});

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
