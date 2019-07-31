// Copyright (c) jdneo. All rights reserved.
// Licensed under the GNU LGPLv3 license.

export namespace JavaLanguageServerCommands {
    export const EXECUTE_WORKSPACE_COMMAND: string = 'java.execute.workspaceCommand';
}

export namespace CheckstyleExtensionCommands {
    export const SET_CHECKSTYLE_CONFIGURATION: string = 'java.checkstyle.setConfiguration';
    export const CHECK_CODE_WITH_CHECKSTYLE: string = 'java.checkstyle.checkCode';
    export const FIX_CHECKSTYLE_VIOLATION: string = 'java.checkstyle.quickFix';
    export const OPEN_OUTPUT_CHANNEL: string = 'java.checkstyle.open.output.channel';
}

export namespace VsCodeCommands {
    export const OPEN: string = 'vscode.open';
}
