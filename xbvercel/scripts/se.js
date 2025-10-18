const THEME_STORAGE_KEY = 'gen1_theme';
        const PROJECT_SORT_KEY = 'gen1_project_sort_order';
        const body = document.body;
        const themeSwitch = document.getElementById('themeSwitch');
        const lightIcon = document.getElementById('lightIcon');
        const moonIcon = document.getElementById('moonIcon');
        const themeText = document.getElementById('themeText');
        const backBtn = document.getElementById('backBtn');
        const projectSortRadios = document.querySelectorAll('input[name="projectSort"]');

        function loadTheme() {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark') {
                body.classList.add('dark-theme');
                themeText.textContent = 'Dark Mode';
                lightIcon.style.display = 'none';
                moonIcon.style.display = 'inline-block';
            } else {
                body.classList.remove('dark-theme');
                localStorage.setItem(THEME_STORAGE_KEY, 'light'); // Ensure default is saved if not set
                themeText.textContent = 'Light Mode';
                lightIcon.style.display = 'inline-block';
                moonIcon.style.display = 'none';
            }
        }

        function toggleTheme() {
            if (body.classList.contains('dark-theme')) {
                body.classList.remove('dark-theme');
                localStorage.setItem(THEME_STORAGE_KEY, 'light');
                themeText.textContent = 'Light Mode';
                lightIcon.style.display = 'inline-block';
                moonIcon.style.display = 'none';
            } else {
                body.classList.add('dark-theme');
                localStorage.setItem(THEME_STORAGE_KEY, 'dark');
                themeText.textContent = 'Dark Mode';
                lightIcon.style.display = 'none';
                moonIcon.style.display = 'inline-block';
            }
        }

        function loadProjectSortOrder() {
            const savedSortOrder = localStorage.getItem(PROJECT_SORT_KEY) || 'newest'; // Default to newest
            const radio = document.getElementById(`sort${savedSortOrder.charAt(0).toUpperCase() + savedSortOrder.slice(1)}`);
            if (radio) {
                radio.checked = true;
            }
        }

        function saveProjectSortOrder(order) {
            localStorage.setItem(PROJECT_SORT_KEY, order);
        }

        themeSwitch.addEventListener('click', toggleTheme);
        backBtn.addEventListener('click', () => {
            window.location.href = 'Welcome.html';
        });

        projectSortRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                saveProjectSortOrder(event.target.value);
            });
        });

        document.addEventListener('DOMContentLoaded', () => {
            loadTheme();
            loadProjectSortOrder();
        });