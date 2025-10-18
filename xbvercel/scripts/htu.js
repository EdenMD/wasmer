const THEME_STORAGE_KEY = 'gen1_theme';
        const body = document.body;

        function loadTheme() {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark') {
                body.classList.add('dark-theme');
            } else {
                body.classList.remove('dark-theme');
            }
        }

        document.addEventListener('DOMContentLoaded', loadTheme);