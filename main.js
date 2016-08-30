const {
    app,
    BrowserWindow
} = require('electron'),
    ipc = require('electron').ipcMain,
    fs = require('fs'),
    changeCase = require('change-case');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        //fullscreen: true
    });

    // and load the index.html of the app.
    win.loadURL(`file://${__dirname}/index.html`);

    // Open the DevTools.
    //win.webContents.openDevTools();

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
    app.quit();
    //}
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

let parseReport = txtResults => {
    let pcDetailsSection = txtResults.split('Quality Assurance Testing Results')[0];
    let testResultsSection = txtResults.split('Quality Assurance Testing Results')[1].split('Burn-in start')[0];
    let testMetaSection = txtResults.split('Quality Assurance Testing Results')[1].split('Burn-in start')[1];

    let pcDetails = parsePcDetails(pcDetailsSection);
    let testResults = parseTestResults(testResultsSection);
    let testMeta = parseTestMeta(testMetaSection);

    return {
        pcDetails,
        testResults,
        testMeta
    };
};

let parsePcDetails = pcDetailsSection => {
    let pcDetails = {},
        pcDetailsSectionArray = pcDetailsSection.split('\r\n');

    let currentParent,
        i = 0;
    for (let line of pcDetailsSectionArray) {
        if (line.indexOf('....') > -1) {
            line = line.replace(/\.{4,}/, '....');
            currentParent = changeCase.camelCase(line.split('....')[0].trim());
            pcDetails[currentParent] = {};
            i = 0;
            line = line.split('....')[1].trim();
        }
        if (currentParent !== undefined) {
            if (line.indexOf(':') > -1) {
                pcDetails[currentParent][changeCase.camelCase(line.split(':')[0].trim())] = cleanUp(line.split(':')[1]).trim();
            } else {
                line = cleanUp(line).trim();
                if (line !== '') {
                    pcDetails[currentParent][i] = line;
                    i++;
                }
            }
        }
    }

    return pcDetails;
};

let parseTestResults = testResultsSection => {
    let testResults = {},
        testResultsSectionArray = testResultsSection.split('\r\n');

    let currentParent;
    for (let line of testResultsSectionArray) {
        if (line.split(' ')[0].regexIndexOf(/[A-Z]{3,}/) > -1) {
            let lineArray = line.trim().split(/\s{2,}/);
            currentParent = changeCase.camelCase(lineArray[0]);
            testResults[currentParent] = {
                name: lineArray[0],
                tests: {}
            };
            line = lineArray.splice(1).join(' ');
        }
        if (currentParent !== undefined) {
            if (line.regexIndexOf(/PASSED|FAILED|N\/A/) > -1) {
                line = line.replace(/\*/g, '');
                let testName = line.replace(/PASSED/g, '').replace(/FAILED/g, '').replace(/N\/A/g, '').trim();
                let testNameAlias = changeCase.camelCase(testName);
                let testResultArray = line.replace(testName, '').trim().split(/\s+/);
                testResults[currentParent].tests[testNameAlias] = {};
                testResults[currentParent].tests[testNameAlias].name = testName;
                testResults[currentParent].tests[testNameAlias].results = testResultArray;
            }
        }
    }

    return testResults;
};

let parseTestMeta = testMetaSection => {
    let testMeta = {};
        testMetaSectionArray = testMetaSection.split('\r\n');

    for (let line of testMetaSectionArray) {
        if (line.indexOf('Tester Name') > -1) {
            testMeta.testerName = line.split(':')[1].trim();
        } else if (line.indexOf('Serial No.') > -1) {
            testMeta.serialNuber = line.split(':')[1].trim();
        }
    }
    return testMeta;
};

ipc.on('new_file', (event, filename) => {
    fs.readFile(filename, 'utf8', function(err, data) {
        if (err) {
            error(event, err);
            return false;
        }

        event.sender.send('report', parseReport(data));
    });
});

let error = (event, text) => {
    event.sender.send('error', JSON.stringify(text));
};

/* Format: [original, replacement] */
let replacements = [
    ['Dell Inc.', 'Dell'],
    ['Sony Corporation', 'Sony'],
    ['Intel(R)', 'Intel'],
    ['Core(TM)', 'Core'],
    ['Turion(tm)', 'Turion'],
    ['alienware', 'Alienware'],
    [',',''],
    ['Atom(TM)', 'Atom'],
    ['hp', 'HP'],
    ['Gigabyte Technology Co. Ltd.', 'Gigabyte'],
    [/(\d+)\.\d+(GB)/, '$1$2'],  // changes 500.10GB to 500GB (e.g.)
    [/\*/g, ''],
    ['(...', ''],
    ['Pc-Check V8.03 Quality Assurance Report', ''],
    ['---------------------------------------', '']
];

let cleanUp = text => {
    for (let replacement of replacements) {
        text = text.replace(replacement[0], replacement[1]);
    }
    return text;
};

//From: http://stackoverflow.com/questions/273789/is-there-a-version-of-javascripts-string-indexof-that-allows-for-regular-expr
String.prototype.regexIndexOf = function(regex, startpos) {
    var indexOf = this.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
};

String.prototype.regexLastIndexOf = function(regex, startpos) {
    regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
    if(typeof (startpos) == "undefined") {
        startpos = this.length;
    } else if(startpos < 0) {
        startpos = 0;
    }
    var stringToWorkWith = this.substring(0, startpos + 1);
    var lastIndexOf = -1;
    var nextStop = 0;
    while((result = regex.exec(stringToWorkWith)) != null) {
        lastIndexOf = result.index;
        regex.lastIndex = ++nextStop;
    }
    return lastIndexOf;
};
