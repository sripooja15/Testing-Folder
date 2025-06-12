/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
var folderId = 64994; // Replace with actual folder ID
define(["N/record", "N/runtime", "N/search", "N/file", "N/task", "N/format"], function(record, runtime, search, file, task, format) {
    function execute(scriptContext) {
        try {
            //new comment
            //Added new commnet branch testing
            log.debug("Triggered Scheduled Script");
            var scriptObj = runtime.getCurrentScript();
            //var testDate = '2025-07-21'; // Change this for testing
            var today = new Date();
            log.debug({ title: "Today's Date", details: today });
            // Get the third previous month
            today.setMonth(today.getMonth() - 3);
            log.debug({ title: 'Adjusted Date (Third Previous Month)', details: today });
            var startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            var endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
           // log.debug({ title: 'Start Date of Third Previous Month', details: startDate });
            //log.debug({ title: 'End Date of Third Previous Month', details: endDate });
            var formattedStartDate = format.format({ value: startDate, type: format.Type.DATE });
            var formattedEndDate = format.format({ value: endDate, type: format.Type.DATE });
            log.debug({ title: 'Formatted Start Date', details: formattedStartDate });
            log.debug({ title: 'Formatted End Date', details: formattedEndDate });
            var filters = [
                ["internalid", "anyof", folderId],
                "AND",
                ["lastmodifieddate", "onorafter", formattedStartDate],
                "AND",
                ["lastmodifieddate", "onorbefore", formattedEndDate]
            ];
            // if (lastProcessedFileId) {
            //     filters.push("AND", ["file.internalid", "greaterthan", lastProcessedFileId]);
            // }
            var folderSearchObj = search.create({
                type: "folder",
                filters: filters,
                columns: [
                    search.createColumn({
                        name: "internalid",
                        join: "file",
                        label: "Internal ID",
                        sort: search.Sort.ASC
                    }),
                    search.createColumn({
                        name: "name",
                        join: "file",
                        label: "Name"
                    })
                ]
            });
            var lastFileIdProcessed = null;
            // var results = folderSearchObj.run().getRange({ start: 0, end: 1 });
            // if (results.length === 0) {
            //     log.debug("No Files Found", "No files to delete in the specified date range.");
            //     return;
            // }
            var pagedResults = folderSearchObj.runPaged({ pageSize: 1 });
            if (pagedResults.count === 0) {
                log.debug("No Files Found", "No files to delete in the specified date range.");
                return;
            }
            folderSearchObj.run().each(function(result) {
                var fileId = result.getValue({ name: "internalid", join: "file" });
                var fileName = result.getValue({ name: "name", join: "file" });
                log.debug("Deleting File", "Name: " + fileName + ", ID: " + fileId);
                try {
                    if (fileId) {
                        file.delete({ id: fileId });
                        log.debug("File Deleted", fileName);
                        lastFileIdProcessed = fileId;
                    }
                } catch (e) {
                    log.error("Error deleting file", e);
                }
                var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
                log.debug("Remaining Governance", remainingUsage);
                if (remainingUsage < 200) {
                    log.debug("Rescheduling", "Governance limit reached.");
                    rescheduleScript(lastFileIdProcessed);
                    return false; // Stop further execution
                }
                return true; // Continue processing
            });
            if (lastFileIdProcessed) {
                log.debug("Script Completed", "Processed all files or rescheduled.");
            }

        } catch (e) {
            log.error("Error", e);
        }
    }

    function rescheduleScript(lastFileIdProcessed) {
        if (!lastFileIdProcessed) return;
        log.debug("Rescheduling Script", "Last Processed File ID: " + lastFileIdProcessed);
        try {
            var scriptObj = runtime.getCurrentScript();
            log.debug("scriptObj.id",scriptObj.id);
            log.debug("scriptObj.deploymentId",scriptObj.deploymentId);
            var scheduledScriptTask = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: scriptObj.id,
                deploymentId: scriptObj.deploymentId,
            });
            var taskId = scheduledScriptTask.submit();
            log.debug('Scheduled Script Task ID', taskId);
        } catch (e) {
            log.error("Error in Rescheduling", e);
        }
    }

    return { execute: execute };
});
