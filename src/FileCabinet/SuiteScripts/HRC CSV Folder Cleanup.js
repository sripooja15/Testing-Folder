/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
var folderId = 54015;
define(["N/record", "N/runtime", "N/search", "N/file", "N/task", "N/format"],
    /**
 * @param{record} record
 * @param{search} search
 */
    function (record, runtime, search, file, task, format)  {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        function execute  (scriptContext) {
          try{
              log.debug("Triggered Scheduled Script");
              var filters = [
                ["internalid", "anyof", folderId]
            ];
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
          }
          catch(e){
            log.error("Error in scheduled script", e);
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
        return {execute:execute}

    });
