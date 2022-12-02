import { BgService } from '~/services/BgService';
import CrashReportService from '~/services/CrashReportService';
import APIService from '~/services/APIService';
import App from '~/components/App.vue';
import SecurityService from '~/services/SecurityService';

declare module 'vue/types/vue' {
    interface Vue {
        // $apiService: APIService;
        // $bgService: BgService;
        $crashReportService: CrashReportService;

        $t: (s: string, ...args) => string;
        $tc: (s: string, ...args) => string;
        $tt: (s: string, ...args) => string;
        $tu: (s: string, ...args) => string;
        $filters: {
            titlecase(s: string): string;
            uppercase(s: string): string;
            L(s: string, ...args): string;
        };
    }
}
