 // Ensure these imports point to your desired Firebase version
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
        import { 
            getAuth, 
            createUserWithEmailAndPassword, 
            signInWithEmailAndPassword, 
            sendEmailVerification, 
            onAuthStateChanged,
            setPersistence, // Import setPersistence
            browserLocalPersistence // Import browserLocalPersistence
        } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

        // Your web app's Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyCxd1eEj4mET0tzasD12lNfno054f6ZN-0",
            authDomain: "xbuilder-64c36.firebaseapp.com",
            projectId: "xbuilder-64c36",
            storageBucket: "xbuilder-64c36.firebasestorage.app",
            messagingSenderId: "652300372081",
            appId: "1:652300372081:web:df1f6f8ea8b537e19133d0"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);

        // Set authentication persistence to LOCAL (default is SESSION, but LOCAL ensures longer-term)
        // This line ensures the session lasts beyond the browser session, ideally for 5 days or more.
        setPersistence(auth, browserLocalPersistence)
            .then(() => {
                // Persistence setting applied successfully
                console.log('Firebase auth persistence set to LOCAL');
            })
            .catch((error) => {
                // Handle Errors here.
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error('Error setting persistence:', errorCode, errorMessage);
            });


        // Get references to elements
        const authForm = document.getElementById('authForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const modeSwitch = document.getElementById('modeSwitch');
        const formTitle = document.getElementById('formTitle');
        const submitButton = authForm.querySelector('button[type="submit"]');
        const messageDiv = document.getElementById('message');
        const resendVerificationLink = document.getElementById('resendVerificationLink');
        const redirectToast = document.getElementById('redirectToast'); // Get the toast element

        let isRegisterMode = true; // Initial state

        // Function to display messages
        function showMessage(msg, type = 'info') {
            messageDiv.textContent = msg;
            messageDiv.className = `message ${type}`;
        }

        // Function to show the redirect toast
        function showRedirectToast() {
            redirectToast.classList.add('show');
        }

        // Function to hide the redirect toast
        function hideRedirectToast() {
            redirectToast.classList.remove('show');
        }

        // Function to handle email verification sending
        async function sendVerificationEmail(user) {
            try {
                await sendEmailVerification(user);
                showMessage('Verification email sent! Please check your inbox (and spam folder).', 'success');
            } catch (error) {
                console.error('Error sending verification email:', error.message);
                showMessage(`Error sending verification email: ${error.message}`, 'error');
            }
        }

        // Toggle between Login and Register modes
        modeSwitch.addEventListener('click', (event) => {
            event.preventDefault();
            isRegisterMode = !isRegisterMode;
            if (isRegisterMode) {
                formTitle.textContent = 'Register for Xbuilder';
                submitButton.textContent = 'Register';
                modeSwitch.innerHTML = 'Already have an account? <a href="#">Login here</a>';
                resendVerificationLink.style.display = 'none';
            } else {
                formTitle.textContent = 'Login to Xbuilder';
                submitButton.textContent = 'Login';
                modeSwitch.innerHTML = 'Don\'t have an account? <a href="#">Register here</a>';
                // Only show resend verification if logged in and not verified
                if (auth.currentUser && !auth.currentUser.emailVerified) {
                     resendVerificationLink.style.display = 'block';
                } else {
                     resendVerificationLink.style.display = 'none';
                }
            }
            messageDiv.textContent = ''; // Clear messages on mode switch
        });

        // Handle form submission
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;

            // Clear previous messages
            messageDiv.textContent = '';
            messageDiv.className = 'message'; // Reset class

            if (isRegisterMode) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    await sendVerificationEmail(user);
                    showMessage('Registration successful! Please verify your email to log in. Redirecting...', 'success');
                    // Redirect after successful registration and email sent
                    showRedirectToast();
                    setTimeout(() => {
                        window.location.href = 'Welcome.html'; 
                    }, 1500); // 1.5 second delay
                } catch (error) {
                    console.error('Registration error:', error.code, error.message);
                    let errorMessage = 'Registration failed.';
                    if (error.code === 'auth/email-already-in-use') {
                        errorMessage = 'This email is already in use. Try logging in.';
                    } else if (error.code === 'auth/weak-password') {
                        errorMessage = 'Password is too weak. Please choose a stronger password.';
                    } else if (error.code === 'auth/invalid-email') {
                        errorMessage = 'Invalid email format.';
                    }
                    showMessage(`${errorMessage} Please try again.`, 'error');
                }
            } else { // Login Mode
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    if (user.emailVerified) {
                        showMessage('Login successful! Redirecting...', 'success');
                        // Redirect to a dashboard or main app page upon successful and verified login
                        showRedirectToast();
                        setTimeout(() => {
                            window.location.href = 'Welcome.html';
                        }, 1500); // 1.5 second delay
                    } else {
                        showMessage('Please verify your email address. A verification link has been sent.', 'warning');
                        resendVerificationLink.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Login error:', error.code, error.message);
                    let errorMessage = 'Login failed.';
                    if (error.code === 'auth/user-not-found') {
                        errorMessage = 'No user found with this email.';
                    } else if (error.code === 'auth/wrong-password') {
                        errorMessage = 'Incorrect password.';
                    } else if (error.code === 'auth/invalid-email') {
                        errorMessage = 'Invalid email format.';
                    } else if (error.code === 'auth/too-many-requests') {
                        errorMessage = 'Too many failed login attempts. Please try again later.';
                    }
                    showMessage(`${errorMessage} Please try again.`, 'error');
                }
            }
        });

        // Handle resend verification email
        resendVerificationLink.addEventListener('click', async (e) => {
            e.preventDefault();
            // Clear previous messages
            messageDiv.textContent = '';
            messageDiv.className = 'message'; // Reset class

            if (auth.currentUser) {
                await sendVerificationEmail(auth.currentUser);
            } else {
                showMessage('Please log in first to resend verification.', 'warning');
            }
        });

        // Listener for auth state changes - handles persistent login and auto-redirect
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is signed in
                if (!user.emailVerified) {
                    // If logged in but email not verified, prompt them
                    showMessage('You are logged in, but your email is not verified. Please check your inbox or resend verification.', 'warning');
                    resendVerificationLink.style.display = 'block';
                } else {
                    // If logged in AND email is verified
                    resendVerificationLink.style.display = 'none'; // Hide resend link
                    // Auto-redirect if user is already logged in, verified, AND currently on the login page
                    if (window.location.pathname.includes('login.html')) {
                        showRedirectToast(); // Show the toast
                        setTimeout(() => {
                            window.location.href = 'Welcome.html';
                        }, 1500); // 1.5 second delay
                    }
                }
            } else {
                // User is signed out
                resendVerificationLink.style.display = 'none';
            }
        });