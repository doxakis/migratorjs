/*
Migrator
--------

DESCRIPTION:
------------
The Migrator class provide a way to manage the migration process of the database in a hybrid mobile application.

HOW IT WORK:
------------
When you call the execute() function, the migration process start.
If it is the first run, it will create a table for the migration.
It will check every migration you define and apply it if needed.
You can skip migration number and add later the migration.
It will apply it, because it track which version have been applied.
For example,
You could apply version 2 and 4. Then, you could apply version 3.
Of course operation of version 4 must not be linked to operation of version 3.

HOW DO YOU MANAGE UNINSTALL, ERASE DATA:
----------------------------------------
UNINSTALL: It will delete the database and all tables (It includes the migration table).
ERASE DATA: It will act has a new install. The migration table is created and all migration is applied.

HOW TO USE:
-----------
var M = new Migrator(self.db, function(number, error) {
   // Function called when the migration has failed.
   // error.message contain the error message.
   // number is the failed migration number.

   // Handle the error...
   // Or show a message...
});

HOW TO DEBUG MIGRATION:
-----------------------
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

HOW TO CREATE A MIGRATION:
--------------------------
M.migration(your migration number, function(t) {
    // t here is a transaction object: http://dev.w3.org/html5/webdatabase/#sqltransaction
    // sql syntax: https://www.sqlite.org/lang.html
    t.executeSql(your sql command);
});
*/

/**
 * Migrator constructor.
 * Create a new instance of Migrator.
 *
 * @param db Required
 * @param errorCallback Required
 * @param successCallback Optional
 */
function Migrator(db, errorCallback, successCallback){

    if (!db) {
        throw new Error("The parameter db is required.");
    }

    if (typeof errorCallback !== 'function') {
        throw new Error("The parameter errorCallback must be a function.");
    }

    // The migration table name.
    var MIGRATOR_TABLE = "_migrator_schema";

    // List of migration
	var migrations = [];

    // State of the migration.
    // 0: not started
    // 1: in progress
    // 2: finished
	var state = 0;

	// Use this method to actually add a migration.
	// You'll probably want to start with 1 for the migration number.
	this.migration = function(number, func){
        // If the migration has already started, do not allow to execute this method.
        if (state > 0){
            throw new Error("Migration process has already started. Please call execute() after this call.");
        }

        if (typeof number !== 'number') {
            throw new Error("The parameter number must be a number");
        }

        if (typeof func !== 'function') {
            throw new Error("The parameter func must be a function.");
        }

        if (number <= 0) {
            throw new Error("First migration is 1.");
        }

        if (migrations[number]) {
            throw new Error("Migration already defined. Use another number.");
        }

        // Add the migration to the list of migrations.
		migrations[number] = func;
	};

	// Execute a given migration by index
	var doMigration = function(number){

        // Check if there is another migration to run.
		if(number < migrations.length){
            db.transaction(function (transaction) {
                transaction.executeSql('select version from ' + MIGRATOR_TABLE + ' WHERE version = ?', [number], function (t, res) {
                    if (res.rows.length > 0) {
                        // Migration already applied.
                        debug(Migrator.DEBUG_HIGH, "Migration %d already applied", [number]);
                        // Do the next migration.
                        doMigration(number+1);
                    } else {
                        // The current migration is not applied.
                        // Trying to apply version
                        debug(Migrator.DEBUG_HIGH, "  Trying to apply migration %d", [number]);

                        // Check if the migration is missing
                        if (!migrations[number]) {
                            // Missing a migration.
                            debug(Migrator.DEBUG_HIGH, "    Missing migration %d", [number]);
                            // Do the next migration.
                            doMigration(number+1);
                        } else {
                            // Found the migration.
                            debug(Migrator.DEBUG_HIGH, "    Found migration %d", [number]);
                            db.transaction(function(t){
                                // Insert in the migration table the version.
                                // If it failed, it will not insert it because it is in a transaction.
                                t.executeSql("insert into " + MIGRATOR_TABLE + " values (?, ?)", [number, new Date()], function(t){
                                    debug(Migrator.DEBUG_HIGH, "      Beginning migration %d", [number]);

                                    // Run the migration.
                                    migrations[number](t);
                                }, function(t, error){
                                    // Catch an error in the migration.
                                    debug(Migrator.DEBUG_HIGH, "      Migration %d failed, error message: %s", [number, error.message]);
                                    errorCallback(number, error);
                                })
                            }, function(error){
                                // Catch an error in the migration.
                                debug(Migrator.DEBUG_HIGH, "      Migration %d failed, error message: %s", [number, error.message]);
                                errorCallback(number, error);
                            }, function() {
                                // The migration has been applied with success.
                                debug(Migrator.DEBUG_HIGH, "      Completed migration %d", [number]);

                                // Do the next migration.
                                doMigration(number+1);
                            });
                        }
                    }
                });
            });
		} else {
            // Finish the migration process.
			debug(Migrator.DEBUG_LOW, "Migration process finished with success.");
			state = 2;
            if (successCallback) {
                successCallback();
            }
		}
	};
	
	// helper that actually calls doMigration from doIt.
	var migrateStarting = function(){
		debug(Migrator.DEBUG_LOW, "Migration process starting.");

		try {
			doMigration(0);
		} catch(e) {
			error(e);
		}
	};

	this.execute = function(){
        // Allow only one call to the method.
		if(state > 0){
            throw new Error("The execute function allow only one call.");
		}
        state = 1;

        // Initialize the migration table.
		db.transaction(function(t){
            // Test if the migration table exists.
			t.executeSql("select version from " + MIGRATOR_TABLE + " LIMIT 1", [], function(t, res){
                // The migration table exists.
				var rows = res.rows;
				var version = rows.item(0).version;
				debug(Migrator.DEBUG_HIGH, "Existing database");

                // Start the migration process.
				migrateStarting();
			}, function(t, err){
				if(err.message.match(/no such table/i)){
                    // The migration table doesn't exist.

                    // Create the migration table.
					t.executeSql("create table " + MIGRATOR_TABLE + "(version INTEGER UNIQUE, appliedon DATETIME)", [], function(){
                        // Insert the migration 0.
						t.executeSql("insert into " + MIGRATOR_TABLE + " values(0, ?)", [new Date()], function(){
                            debug(Migrator.DEBUG_HIGH, "New migration database created");

                            // Start the migration process.
							migrateStarting();
						}, function(t, err){
							error("Unrecoverable error inserting initial version into db: %o", err);
						});
					}, function(t, err){
						error("Unrecoverable error creating version table: %o", err);
					});
				} else {
					error("Unrecoverable error resolving schema version: %o", err);
				}
			});
		});

		return this;
	};

	// Debugging stuff.
	var log = (window.console && console.log) ? function() { console.log.apply(console, argumentsToArray(arguments)) } : function(){};
	var error = (window.console && console.error) ? function() { console.error.apply(console, argumentsToArray(arguments)) } : function(){};
	
	var debugLevel = Migrator.DEBUG_NONE;

	var argumentsToArray = function(args) { return Array.prototype.slice.call(args); };
	this.setDebugLevel = function(level){
		debugLevel = level;
	}
	
	var debug = function(minLevel, message, args){
		if(debugLevel >= minLevel){
			var newArgs = [message];
			if(args != null) for(var i in args) newArgs.push(args[i]);
		
			log.apply(null, newArgs);
		}
	}
}

// no output, low output, or high output.
Migrator.DEBUG_NONE = 0;
Migrator.DEBUG_LOW = 1;
Migrator.DEBUG_HIGH = 2;

