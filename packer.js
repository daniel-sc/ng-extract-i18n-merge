const fs = require("fs");
const path = require("path");
function createDirIfNotExist(dir) {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyFileSync( source, target ) {
    let targetFile = target;
    // If target is a directory, a new file with the same name will be created
    if ( fs.existsSync( target ) ) {
        if ( fs.lstatSync( target ).isDirectory() ) {
            targetFile = path.join( target, path.basename( source ) );
        }
    }
    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync( source, target ) {
    let files = [];

    // Check if folder needs to be created or integrated
    const targetFolder = path.join( target, path.basename( source ) );
    createDirIfNotExist(targetFolder);

    // Copy
    if ( fs.lstatSync( source ).isDirectory() ) {
        files = fs.readdirSync( source );
        files.forEach( function ( file ) {
            var curSource = path.join( source, file );
            if ( fs.lstatSync( curSource ).isDirectory() ) {
                copyFolderRecursiveSync( curSource, targetFolder );
            } else {
                copyFileSync( curSource, targetFolder );
            }
        } );
    }
}

fs.rmSync("pack", { recursive: true, force: true });
createDirIfNotExist("pack/src");
createDirIfNotExist("pack/schematics/ng-add");
createDirIfNotExist("pack/schematics/migrations");

copyFolderRecursiveSync("dist/src", "pack/dist");
copyFolderRecursiveSync("dist/schematics", "pack/dist");
fs.copyFileSync("src/schema.json", "pack/src/schema.json");
fs.copyFileSync("schematics/collection.json", "pack/schematics/collection.json");
fs.copyFileSync("schematics/ng-add/schema.json", "pack/schematics/ng-add/schema.json");
fs.copyFileSync("schematics/migrations/migrations.json", "pack/schematics/migrations/migrations.json");
fs.copyFileSync("LICENSE.txt", "pack/LICENSE.txt");
fs.copyFileSync("README.md", "pack/README.md");
fs.copyFileSync("package.json", "pack/package.json");
fs.copyFileSync("builders.json", "pack/builders.json");
