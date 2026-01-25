const RULES = [
    {
        level: 'error',
        test: (message) => {
            const lower = message.toLowerCase();
            return lower.includes('error') || lower.includes('fail');
        }
    },
    {
        level: 'warning',
        test: (message) => {
            const lower = message.toLowerCase();
            return lower.includes('warning') || lower.includes('cancel');
        }
    },
    {
        level: 'success',
        test: (message) => message.toLowerCase().includes('success')
    }
];
export function classifyLog(message) {
    for (const rule of RULES) {
        if (rule.test(message)) {
            return rule.level;
        }
    }
    return 'info';
}
