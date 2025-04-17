const vscode = require('vscode');
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const disposable = vscode.commands.registerCommand('pandoc-grid-table-formatter.formatTable', async function () {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const alignment = await askAlignment();
			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);
			const formattedTable = formatPandocGridTable(selectedText, alignment);
			editor.edit(editBuilder => {
				editBuilder.replace(selection, formattedTable);
			});
			vscode.window.showInformationMessage('Formatting table with alignment: ' + alignment);
		}
	});
	context.subscriptions.push(disposable);
}

async function askAlignment() {
	const options = ['Left', 'Center', 'Right'];
	const selected = await vscode.window.showQuickPick(options, {
		placeHolder: 'Chose table alignment',
	});
	return selected?.toLowerCase();
}

function formatPandocGridTable(text, alignment) {
	const lines = text.split('\n').filter(line => line.trim() !== '');
	let headerIndex = 0;

	for (let i = 0; i < lines.length; i++) {
		if (lines[i].includes('===')) {
			headerIndex = i;
			break;
		}
	}

	let headerLines = lines.slice(0, headerIndex);
	let bodyLines = lines.slice(headerIndex + 1, lines.length);
	const parseRow = line => line.split('|').slice(1, -1).map(cell => cell.trim());

	const rawHeaderRows = headerLines.map(parseRow);
	const rawBodyRows = bodyLines.map(parseRow);

	const maxCols = Math.max(
		...rawHeaderRows.map(r => r.length),
		...rawBodyRows.map(r => r.length)
	);

	const bodyRows = rawBodyRows.map(r => {
		const copy = [...r];
		while (copy.length < maxCols) copy.push('');
		return copy;
	});

	const colWidths = Array(maxCols).fill(0);
	[...rawHeaderRows, ...bodyRows].forEach(row => {
		row.forEach((cell, idx) => {
			cell.split('\\n').forEach(part => {
				colWidths[idx] = Math.max(colWidths[idx], part.length);
			});
		});
	});

	const buildLine = (sepChar, junctionChar) =>
		junctionChar + colWidths.map(w => sepChar.repeat(w + 2)).join(junctionChar) + junctionChar;

	const buildHeaderRow = (cells) => {
		let result = '|';
		let colIndex = 0;

		cells.forEach(cell => {
			const remainingCols = maxCols - colIndex;
			const span = Math.ceil(remainingCols / (cells.length - cells.indexOf(cell)));
			const totalWidth = colWidths.slice(colIndex, colIndex + span).reduce((a, b) => a + b, 0) + (2 * span) + (span - 1);
			result += ' ' + cell.padEnd(totalWidth - 1) + '|';
			colIndex += span;
		});

		result += '\n';
		return result;
	};

	function buildAlignmentLine(line, alignment) {
		if(alignment == 'left'){
			line = line.replaceAll("+=", "+:");
		}
		if(alignment == 'center'){
			line = line.replaceAll("+=", "+:");
			line = line.replaceAll("=+", ":+");
		}
		if(alignment == 'right'){
			line = line.replaceAll("=+", ":+");
		}
		return line;
	}

	const buildBodyRow = (cells) => {
		const cellLines = cells.map(cell => cell.split('\\n'));
		const maxLines = Math.max(...cellLines.map(cl => cl.length));
		let rows = '';
		for (let i = 0; i < maxLines; i++) {
			let line = '| ';
			cellLines.forEach((lines, idx) => {
				const content = lines[i] || '';
				line += content.padEnd(colWidths[idx]) + ' | ';
			});
			rows += line + '\n';
		}
		return rows;
	};

	let result = '';

	result += buildLine('-', '+') + '\n';

	rawHeaderRows.forEach((row, index) => {
		result += buildHeaderRow(row);
		if (index === rawHeaderRows.length - 1) {
			let lastHeaderRow = buildLine('=', '+') + '\n';
			lastHeaderRow = buildAlignmentLine(lastHeaderRow, alignment);
			result += lastHeaderRow;
		} else {
			result += buildLine('-', '+') + '\n';
		}
	});

	bodyRows.forEach(row => {
		result += buildBodyRow(row);
		result += buildLine('-', '+') + '\n';
	});

	return result;
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
