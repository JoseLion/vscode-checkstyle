// Copyright (c) jdneo. All rights reserved.
// Licensed under the GNU LGPLv3 license.

import * as _ from 'lodash';
import * as vscode from 'vscode';
import { checkstyleChannel } from './checkstyleChannel';
import { checkstyleDiagnosticCollector } from './checkstyleDiagnosticCollector';
import { checkstyleStatusBar } from './checkstyleStatusBar';
import { executeJavaLanguageServerCommand } from './commands/executeJavaLanguageServerCommand';
import { CheckstyleExtensionCommands } from './constants/commands';
import { FileSynchronizer, SyncedFile } from './features/FileSynchronizer';
import { ICheckstyleResult } from './models';
import { handleErrors } from './utils/errorUtils';
import { getCheckstyleConfigurationPath, getCheckstyleProperties } from './utils/settingUtils';

class CheckstyleDiagnosticManager implements vscode.Disposable {

    private context: vscode.ExtensionContext;
    private listeners: vscode.Disposable[];
    private pendingDiagnostics: Set<SyncedFile>;
    private syncedFiles: Map<string, SyncedFile>;
    private synchronizer: FileSynchronizer;
    private diagnosticDelayTrigger: (() => Promise<void>) & _.Cancelable;

    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        this.listeners = [];
        this.pendingDiagnostics = new Set();
        this.syncedFiles = new Map();
        this.synchronizer = new FileSynchronizer(this.context);
        this.diagnosticDelayTrigger = _.debounce(this.sendPendingDiagnostics.bind(this), 200);
        vscode.workspace.onDidOpenTextDocument(this.onDidOpenTextDocument, this, this.listeners);
        vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this.listeners);
        vscode.workspace.onDidCloseTextDocument(this.onDidCloseTextDocument, this, this.listeners);
        vscode.workspace.textDocuments.forEach(this.onDidOpenTextDocument, this);
    }

    public dispose(): void {
        this.synchronizer.dispose();
        for (const listener of this.listeners) {
            listener.dispose();
        }
    }

    private onDidOpenTextDocument(document: vscode.TextDocument): void {
        if (!(document.languageId === 'java' && document.uri.scheme === 'file')) {
            return;
        }

        const filePath: string = document.uri.fsPath;
        if (this.syncedFiles.has(filePath)) {
            return;
        }

        const syncedFile: SyncedFile = new SyncedFile(document, this.synchronizer);
        this.syncedFiles.set(filePath, syncedFile);
        syncedFile.open();
        this.requestDiagnostic(syncedFile);
    }

    private onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent): void {
        const filePath: string = e.document.uri.fsPath;
        const syncedFile: SyncedFile | undefined = this.syncedFiles.get(filePath);
        if (!syncedFile) {
            return;
        }
        syncedFile.onContentChanged(e);
        this.requestDiagnostic(syncedFile);
    }

    private onDidCloseTextDocument(document: vscode.TextDocument): void {
        const filePath: string = document.uri.fsPath;
        const syncedFile: SyncedFile | undefined = this.syncedFiles.get(filePath);
        if (!syncedFile) {
            return;
        }
        this.syncedFiles.delete(filePath);
        syncedFile.close();
    }

    private requestDiagnostic(file: SyncedFile): void {
        this.pendingDiagnostics.add(file);
        this.diagnosticDelayTrigger();
    }

    private async sendPendingDiagnostics(): Promise<void> {
        await this.synchronizer.flush();

        for (const file of this.pendingDiagnostics.values()) {
            const configurationPath: string = getCheckstyleConfigurationPath(file.realUri);
            if (configurationPath === '') {
                checkstyleChannel.appendLine('Checkstyle configuration file not set yet, skip the check.');
                return;
            }

            try {
                const results: ICheckstyleResult[] | undefined = await executeJavaLanguageServerCommand<ICheckstyleResult[]>(
                    CheckstyleExtensionCommands.CHECK_CODE_WITH_CHECKSTYLE, file.syncUri.toString(), configurationPath, getCheckstyleProperties(file.realUri));
                if (!results) {
                    checkstyleChannel.appendLine('Unable to get results from Language Server.');
                    return;
                }
                checkstyleDiagnosticCollector.delete(file.realUri);
                checkstyleDiagnosticCollector.addDiagnostics(file.realUri, results);
                checkstyleStatusBar.showStatus();
            } catch (error) {
                handleErrors(error);
            }
        }
        this.pendingDiagnostics.clear();
    }
}

export const checkstyleDiagnosticManager: CheckstyleDiagnosticManager = new CheckstyleDiagnosticManager();