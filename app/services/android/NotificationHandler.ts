import { $tc } from '~/helpers/locale';

@NativeClass
export class NotificationHandler extends net.gotev.uploadservice.observer.task.AbstractSingleNotificationHandler {
    constructor(uploadService) {
        super(uploadService);
        return global.__native(this);
    }
    updateNotification(
        notificationManager: android.app.NotificationManager,
        notificationBuilder: androidx.core.app.NotificationCompat.Builder,
        tasks: java.util.HashMap<string, net.gotev.uploadservice.observer.task.AbstractSingleNotificationHandler.TaskData>
    ): androidx.core.app.NotificationCompat.Builder {
        const values = tasks.values().toArray();
        // const runningTasks= [];
        let notificationConfig: net.gotev.uploadservice.data.UploadNotificationStatusConfig;
        let info: net.gotev.uploadservice.data.UploadInfo;
        for (let index = 0; index < values.length; index++) {
            const task = values[index] as net.gotev.uploadservice.observer.task.AbstractSingleNotificationHandler.TaskData;
            if (task.getStatus() === net.gotev.uploadservice.observer.task.AbstractSingleNotificationHandler.TaskStatus.InProgress) {
                notificationConfig = task.getConfig();
                info = task.getInfo();
                break;
            }
        }
        if (!notificationConfig || !info) {
            return notificationBuilder;
        }
        console.log('test1', tasks.size());
        const placeholdersProcessor = net.gotev.uploadservice.UploadServiceConfig.getPlaceholdersProcessor();
        const title = placeholdersProcessor.processPlaceholders(notificationConfig.getTitle(), info);
        const message = placeholdersProcessor.processPlaceholders(notificationConfig.getMessage(), info);
        console.log('tasks test', tasks.size(), title, message);
        // tasks.forEach((task) => {
        //     console.log('task test', task);
        // });
        return notificationBuilder.setContentTitle(title).setContentText(message).setProgress(100, info.getProgressPercent(), false).setSmallIcon(17301589);
    }
}
