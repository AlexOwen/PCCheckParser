# PC Check Parser

PC Check Parser parses a PC Check text report (v8.03 is supported) and allows the user to create a customisable shop label, system report and test report.

It is based on Electron, and must be built with Electron Packager, using a command such as the one below (for Windows):

electron-packager . "PC Check Parser" --out=dist/win --platform=win32 --arch=x64 --version=1.3.3

SCSS files also need to be compiled before packaging takes place.

This application is not actively maintained, but changes can be made on request.
