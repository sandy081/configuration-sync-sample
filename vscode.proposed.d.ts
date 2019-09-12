/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * This is the place for API experiments and proposals.
 * These API are NOT stable and subject to change. They are only available in the Insiders
 * distribution and CANNOT be used in published extensions.
 *
 * To test these API in local environment:
 * - Use Insiders release of VS Code.
 * - Add `"enableProposedApi": true` to your package.json.
 * - Copy this file to your project.
 */

declare module 'vscode' {

	// #region Sandy - User data synchronization

	export namespace window {

		export function registerUserDataProvider(name: string, userDataProvider: UserDataProvider): Disposable;

	}

	export class UserDataError extends Error {

		static VersionExists(): UserDataError;

		/**
		 * Creates a new userData error.
		 */
		constructor();
	}

	export interface UserDataProvider {

		read(key: string): Promise<{ version: number, content: string } | null>;

		write(key: string, version: number, content: string): Promise<void>;

	}

    //#endregion

}