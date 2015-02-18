# Migrator JS
Database migration tool in javascript

Based on https://github.com/nanodeath/JS-Migrator

## DESCRIPTION
The Migrator class provide a way to manage the migration process of the database in a hybrid mobile application.

## HOW IT WORK
When you call the execute() function, the migration process start.
If it is the first run, it will create a table for the migration.
It will check every migration you define and apply it if needed.
You can skip migration number and add later the migration.
It will apply it, because it track which version have been applied.
For example,
You could apply version 2 and 4. Then, you could apply version 3.
Of course operation of version 4 must not be linked to operation of version 3.

## HOW DO YOU MANAGE UNINSTALL, ERASE DATA:
UNINSTALL: It will delete the database and all tables (It includes the migration table).

ERASE DATA: It will act has a new install. The migration table is created and all migration is applied.

## HOW TO USE:
```javascript
var M = new Migrator(db, function(number, error) {
  // Function called when the migration has failed.
  // error.message contain the error message.
  // number is the failed migration number.
  
  // Handle the error...
  // Or show a message...
});
```

## HOW TO DEBUG MIGRATION:
-Connect the device on the computer.
-Make sure the device is detected by the computer.
-Make sure USB debugging is enabled on the device.
-Set the debug level (M.setDebugLevel(Migrator.DEBUG_HIGH);)
-Upload the app to the device
-Start chrome browser
-Enter the address: chrome://inspect/#devices
-Start the application on the device
-The device should appear on chrome browser.
-Click on inspect link.
-Open the console tab.
-See the log

## HOW TO CREATE A MIGRATION:
```javascript
M.migration(1, function(t) {
  // t here is a transaction object: http://dev.w3.org/html5/webdatabase/#sqltransaction
  // sql syntax: https://www.sqlite.org/lang.html
  t.executeSql("create table user(id integer primary key, name text)");
  t.executeSql("insert into user(name) values('max')");
});
M.migration(2, function(t) {
  t.executeSql("insert into user(name) values('john')");
});
```
