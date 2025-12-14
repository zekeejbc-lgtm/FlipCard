# Authentication System Design - Student Exam Scheduling App

## 1. USER DATA SCHEMA

### Users Table/Sheet Structure

```
Column Name          | Type        | Constraints          | Notes
---------------------|-------------|----------------------|--------------------------------
userId               | String (UUID) | Primary Key, Auto   | Unique identifier
username             | String      | Unique, NOT NULL     | Min 3 chars, alphanumeric + underscore
passwordHash         | String      | NOT NULL             | bcrypt/Argon2 hash
passwordSalt         | String      | NOT NULL             | For password hashing
profilePictureURL    | String      | Optional             | Google Drive file URL
firstName            | String      | NOT NULL             | 
lastName             | String      | NOT NULL             | 
idCode               | String      | Unique, NOT NULL     | Student/Employee ID
email                | String      | Unique, NOT NULL     | Personal email
schoolEmail          | String      | Unique, NOT NULL     | Institutional email
birthday             | Date        | Optional             | Format: YYYY-MM-DD
school               | String      | Fixed Value          | "University of Southeastern Philippines Tagum Unit"
college              | String      | NOT NULL             | "College of Teacher Education and Technology"
program              | String      | NOT NULL             | "Bachelor of Secondary Education"
major                | String      | NOT NULL             | Dropdown: "Mathematics" | "Filipino" | "English"
year                 | Integer     | NOT NULL             | Range: 1-6 (dropdown)
section              | String      | NOT NULL             | e.g., "A", "B1", "2A"
isGuest              | Boolean     | Default: false       | Guest user flag
guestExpiryDate      | DateTime    | Optional             | When guest access expires
guestActionCount     | Integer     | Default: 0           | Track guest actions
loginAttempts        | Integer     | Default: 0           | Failed login counter (security)
lastLoginAttempt     | DateTime    | Optional             | Timestamp of last login try
accountLocked        | Boolean     | Default: false       | Lock after N failed attempts
lockedUntil          | DateTime    | Optional             | Account lock expiry
createdDate          | DateTime    | Auto                 | Account creation timestamp
lastLogin            | DateTime    | Optional             | Last successful login
lastModified         | DateTime    | Auto                 | Profile update timestamp
emailVerified        | Boolean     | Default: false       | Email verification status
emailVerificationToken | String    | Optional             | One-time verification token
```

---

## 2. AUTHENTICATION FLOWS

### 2.1 LOGIN FLOW

```
User Input: Username + Password
    ↓
[Step 1] Validate Input Format
    - Check username not empty
    - Check password not empty
    - Return: {valid: boolean, errors: []}
    ↓
[Step 2] Query Database for User
    - SELECT * FROM Users WHERE username = {input}
    - If no user found → Return {success: false, error: "Invalid credentials"}
    - If found, proceed to Step 3
    ↓
[Step 3] Check Account Status
    - If accountLocked == true:
        - Check if lockedUntil > currentTime
        - If true → Return {success: false, error: "Account locked until {time}"}
    - If isGuest == true → Prompt user to register
    ↓
[Step 4] Validate Password
    - Compare input password with stored passwordHash
    - If match:
        - Reset loginAttempts to 0
        - Update lastLogin = currentDateTime
        - Generate sessionToken (JWT or session ID)
        - Return {success: true, userId, sessionToken, userData}
    - If no match:
        - Increment loginAttempts
        - If loginAttempts >= 5:
            - Set accountLocked = true
            - Set lockedUntil = currentTime + 30 minutes
            - Send email alert to user
        - Return {success: false, error: "Invalid credentials"}
```

### 2.2 REGISTRATION FLOW

```
User Input: All 15+ registration fields + Profile Picture file
    ↓
[Step 1] Validate All Input Fields
    - Name: Not empty, max 100 chars
    - Email: Valid email format, not already used
    - School Email: Valid .edu format, not already used
    - ID Code: Not empty, not already used
    - Username: 3-20 chars, alphanumeric + underscore, not already used
    - Password: Must pass strength check (Step 2)
    - All required fields present
    - Return: {valid: boolean, fieldErrors: {field: error}}
    ↓
[Step 2] Check Password Strength
    - Min 8 characters
    - At least 1 uppercase letter (A-Z)
    - At least 1 lowercase letter (a-z)
    - At least 1 number (0-9)
    - At least 1 special character (!@#$%^&*)
    - Not contain username or email
    - Return: {strength: "weak"|"medium"|"strong", feedback: []}
    ↓
[Step 3] Check Username & Email Availability
    - Query: SELECT COUNT(*) FROM Users WHERE username = {input} OR email = {input} OR schoolEmail = {input} OR idCode = {input}
    - If count > 0 → Return {available: false, takenFields: []}
    ↓
[Step 4] Process Profile Picture
    - If file uploaded:
        - Validate file type (JPG, PNG only)
        - Validate file size (max 5MB)
        - Upload to Google Drive folder (1hOcAuLm7n4y_dJf2Dh_rqLZfbzyQFu8k)
        - Get shareable file URL
        - Return: {success: true, fileURL}
    - If no file → profilePictureURL = default avatar URL
    ↓
[Step 5] Create New User Record
    - Generate userId = UUID
    - Hash password with bcrypt (salt rounds: 12)
    - INSERT INTO Users:
        {
            userId, username, passwordHash, passwordSalt,
            firstName, lastName, idCode, email, schoolEmail, birthday,
            school, college, program, major, year, section,
            profilePictureURL, isGuest: false, createdDate: NOW,
            emailVerified: false, loginAttempts: 0, accountLocked: false
        }
    - Generate emailVerificationToken (random string)
    - Send verification email with token link
    - Return {success: true, userId, message: "Please verify your email"}
    ↓
[Step 6] Optional: Auto-Login
    - Generate sessionToken
    - Set session/JWT token with expiry
    - Return: {success: true, userId, sessionToken}
```

### 2.3 GUEST USER FLOW

```
User Accesses App Without Login
    ↓
[Step 1] Check Browser Storage
    - If guestSessionToken exists and valid → Allow access
    - If expired → Clear token
    ↓
[Step 2] Create Temporary Guest Session
    - Generate guestUserId (temporary, not stored in main Users table)
    - Generate guestSessionToken with 24-hour expiry
    - Store in browser localStorage
    - Store minimal guest session data: {guestUserId, createdTime, actionCount: 0}
    ↓
[Step 3] Track Guest Actions
    - Increment guestActionCount on every meaningful action
    - Actions include: View exam, Preview schedule, etc.
    - Exclude: Navigation, Page views
    ↓
[Step 4] Guest Action Limit Trigger (After N Actions)
    - If guestActionCount >= 5 (configurable):
        - Show modal: "Guest access limited. Please login or register."
        - Provide links to LoginForm and RegisterForm
        - Block further exam viewing actions
    ↓
[Step 5] Guest Session Expiry (24 hours)
    - If guestSessionToken.expiryTime < currentTime:
        - Clear localStorage
        - Redirect to login
        - Show message: "Your guest session expired. Please login."
```

### 2.4 PROFILE PAGE FLOW

```
User Navigates to Profile Page
    ↓
[Step 1] Load Current User Data
    - Fetch user record from database
    - Filter sensitive fields (passwordHash, passwordSalt, loginAttempts, etc.)
    - Return complete profile data
    ↓
[Step 2] Display Mode (Read-only)
    - Show all user information
    - Show profile picture
    - Show account stats (createdDate, lastLogin, emailVerified status)
    - Show "Edit Profile" button
    ↓
[Step 3] Edit Mode (Click Edit)
    - Enable form fields for editing
    - Fields can be edited: firstName, lastName, birthday, profilePictureURL, 
                           major, year, section, schoolEmail
    - Fields are read-only: username, idCode, email, school, college, program, createdDate
    - Include separate "Change Password" button (different workflow)
    ↓
[Step 4] Update Profile Submission
    - Validate changed fields only
    - Profile picture: Same as registration upload process
    - Other fields: Standard validation
    - UPDATE Users SET {changedFields}, lastModified = NOW WHERE userId = {current}
    - Return: {success: true, message: "Profile updated successfully"}
    - Refresh UI with new data
    ↓
[Step 5] Change Password Workflow
    - Require current password verification first
    - New password must pass strength check
    - Cannot reuse last 3 passwords (store password history)
    - UPDATE passwordHash, passwordSalt WHERE userId = {current}
    - Invalidate all active sessions (force re-login)
    - Return: {success: true, message: "Password changed. Please login again."}
```

---

## 3. BACKEND FUNCTIONS (Google Apps Script)

### 3.1 Core Authentication Functions

#### Function: `registerUser(userData, profilePicFile)`
**Input:**
```
userData = {
    firstName, lastName, idCode, email, schoolEmail, birthday,
    major, year, section, username, password
}
profilePicFile = File object (optional)
```

**Output:**
```
{
    success: boolean,
    userId: string | null,
    error: string | null,
    fieldErrors: {field: error} | null,
    message: string
}
```

**Pseudocode:**
```
1. VALIDATE_INPUT(userData):
   - Check all required fields present
   - Check field formats (email, date, string lengths)
   - If invalid → Return {success: false, fieldErrors: {...}}

2. CHECK_USERNAME_AVAILABLE(userData.username):
   - Query Users sheet
   - If exists → Return error in fieldErrors

3. CHECK_EMAIL_AVAILABLE(userData.email, userData.schoolEmail):
   - Query Users sheet
   - If exists → Return error in fieldErrors

4. CHECK_PASSWORD_STRENGTH(userData.password):
   - Apply regex validations
   - If weak → Return error in fieldErrors

5. PROCESS_PROFILE_PICTURE(profilePicFile):
   - If file provided:
     - Validate MIME type (image/jpeg, image/png)
     - Validate file size < 5MB
     - Upload to Google Drive folder ID: 1hOcAuLm7n4y_dJf2Dh_rqLZfbzyQFu8k
     - Get shareable link
     - profilePictureURL = returned URL
   - Else:
     - profilePictureURL = DEFAULT_AVATAR_URL

6. HASH_PASSWORD(userData.password):
   - Generate salt
   - Create bcrypt hash (or use Utilities.computeDigest with HMAC-SHA256)
   - Return {hash, salt}

7. CREATE_USER_RECORD:
   - userId = generateUUID()
   - Build record with all fields + timestamps
   - INSERT into Users sheet
   - Return {success: true, userId}

8. SEND_VERIFICATION_EMAIL(userData.email, verificationToken):
   - Create email body with verification link
   - MailApp.sendEmail(...)
   - Return success status
```

---

#### Function: `loginUser(username, password)`
**Input:**
```
username: string
password: string
```

**Output:**
```
{
    success: boolean,
    userId: string | null,
    sessionToken: string | null,
    userData: {userId, username, firstName, lastName, profilePictureURL, major, year} | null,
    error: string,
    message: string
}
```

**Pseudocode:**
```
1. VALIDATE_INPUT(username, password):
   - Check not empty
   - If invalid → Return {success: false, error: "..."}

2. QUERY_USER(username):
   - SELECT * FROM Users WHERE username = username
   - If not found → Return {success: false, error: "Invalid credentials"}
   - Store user record in memory

3. CHECK_ACCOUNT_STATUS(user.accountLocked, user.lockedUntil):
   - If locked and lockedUntil > NOW:
     - Return {success: false, error: "Account locked until..."}
   - If locked but lockedUntil <= NOW:
     - Unlock account (set accountLocked = false)

4. VERIFY_PASSWORD(password, user.passwordHash, user.passwordSalt):
   - Compare using bcrypt.compare(password, hash)
   - If match:
       - RESET_LOGIN_ATTEMPTS(userId) → Set loginAttempts = 0
       - UPDATE_LAST_LOGIN(userId) → Set lastLogin = NOW
       - sessionToken = GENERATE_JWT_TOKEN(userId, expiryTime: 24 hours)
       - FilteredUserData = {userId, username, firstName, lastName, profilePictureURL, major, year, college, program}
       - Return {success: true, userId, sessionToken, userData: FilteredUserData}
   - Else:
       - INCREMENT_LOGIN_ATTEMPTS(userId)
       - If loginAttempts >= 5:
           - LOCK_ACCOUNT(userId, lockedUntil: NOW + 30 minutes)
           - SEND_SECURITY_ALERT(user.email, "Multiple failed login attempts")
       - Return {success: false, error: "Invalid credentials"}
```

---

#### Function: `validateUsernameAvailable(username)`
**Input:**
```
username: string
```

**Output:**
```
{
    available: boolean,
    error: string | null
}
```

**Pseudocode:**
```
1. VALIDATE_FORMAT(username):
   - Check length: 3-20 characters
   - Check pattern: ^[a-zA-Z0-9_]+$
   - If invalid → Return {available: false, error: "Invalid username format"}

2. QUERY_DATABASE(username):
   - SELECT COUNT(*) FROM Users WHERE username = username
   - If count > 0:
       - Return {available: false, error: "Username already taken"}
   - Else:
       - Return {available: true, error: null}
```

---

#### Function: `checkPasswordStrength(password)`
**Input:**
```
password: string
```

**Output:**
```
{
    strength: "weak" | "medium" | "strong",
    feedback: [string],
    passedChecks: {
        length: boolean,
        uppercase: boolean,
        lowercase: boolean,
        number: boolean,
        specialChar: boolean,
        noUserInfo: boolean
    }
}
```

**Pseudocode:**
```
1. INITIALIZE:
   checks = {length: false, uppercase: false, lowercase: false, number: false, specialChar: false, noUserInfo: false}
   feedback = []

2. LENGTH_CHECK:
   - If password.length >= 8:
       - checks.length = true
   - Else:
       - feedback.push("At least 8 characters required")

3. UPPERCASE_CHECK:
   - If /[A-Z]/.test(password):
       - checks.uppercase = true
   - Else:
       - feedback.push("At least 1 uppercase letter required")

4. LOWERCASE_CHECK:
   - If /[a-z]/.test(password):
       - checks.lowercase = true
   - Else:
       - feedback.push("At least 1 lowercase letter required")

5. NUMBER_CHECK:
   - If /[0-9]/.test(password):
       - checks.number = true
   - Else:
       - feedback.push("At least 1 number required")

6. SPECIAL_CHAR_CHECK:
   - If /[!@#$%^&*]/.test(password):
       - checks.specialChar = true
   - Else:
       - feedback.push("At least 1 special character (!@#$%^&*) required")

7. USER_INFO_CHECK:
   - If password does not contain username or email fragments:
       - checks.noUserInfo = true
   - Else:
       - feedback.push("Password contains personal information")

8. CALCULATE_STRENGTH:
   - passedCount = COUNT(checks where value == true)
   - If passedCount >= 5:
       - strength = "strong"
   - Else if passedCount >= 3:
       - strength = "medium"
   - Else:
       - strength = "weak"

9. RETURN {strength, feedback, passedChecks}
```

---

#### Function: `updateUserProfile(userId, updatedData)`
**Input:**
```
userId: string
updatedData = {
    firstName: string | null,
    lastName: string | null,
    birthday: date | null,
    profilePictureURL: string | null,
    major: string | null,
    year: number | null,
    section: string | null
    // sensitive fields like username, idCode are NOT included
}
```

**Output:**
```
{
    success: boolean,
    error: string | null,
    message: string,
    updatedUser: {} | null
}
```

**Pseudocode:**
```
1. VALIDATE_USER_EXISTS(userId):
   - Query Users WHERE userId = userId
   - If not found → Return {success: false, error: "User not found"}

2. VALIDATE_EDITABLE_FIELDS:
   - Check updatedData only contains allowed fields
   - Validate each field format/constraints
   - If invalid → Return {success: false, error: "Invalid field data"}

3. HANDLE_PROFILE_PICTURE:
   - If updatedData.profilePictureURL is a new file:
       - Upload to Google Drive (same as registration)
       - Update updatedData.profilePictureURL with new URL

4. UPDATE_DATABASE:
   - UPDATE Users SET {updatedData fields}, lastModified = NOW WHERE userId = userId
   - If error → Return {success: false, error: "Database update failed"}

5. RETURN_UPDATED_USER:
   - Query updated user record
   - Filter sensitive fields
   - Return {success: true, updatedUser: {...}}
```

---

#### Function: `getUser(userId)`
**Input:**
```
userId: string (with authentication token validation)
```

**Output:**
```
{
    success: boolean,
    user: {} | null,
    error: string | null
}
```

**Pseudocode:**
```
1. VALIDATE_AUTHENTICATION:
   - Check if request includes valid sessionToken
   - If invalid/expired → Return {success: false, error: "Unauthorized"}

2. VALIDATE_AUTHORIZATION:
   - Check if requesting userId matches authenticated userId
   - Or check if requester is admin
   - Else → Return {success: false, error: "Forbidden"}

3. QUERY_USER:
   - SELECT * FROM Users WHERE userId = userId
   - If not found → Return {success: false, error: "User not found"}

4. FILTER_SENSITIVE_DATA:
   - Remove: passwordHash, passwordSalt, loginAttempts, accountLocked, lockedUntil, loginAttempt timestamps
   - Keep: All profile data, createdDate, lastLogin, emailVerified

5. RETURN_USER:
   - Return {success: true, user: {filtered data}}
```

---

#### Function: `getProfilePicture(userId)`
**Input:**
```
userId: string
```

**Output:**
```
{
    success: boolean,
    profilePictureURL: string | null,
    error: string | null
}
```

**Pseudocode:**
```
1. QUERY_USER(userId):
   - SELECT profilePictureURL FROM Users WHERE userId = userId
   - If not found → Return {success: false, error: "User not found"}
   - If profilePictureURL is null → Return {success: true, profilePictureURL: DEFAULT_AVATAR}

2. VERIFY_DRIVE_FILE_ACCESS:
   - Check if Drive file still exists and accessible
   - If not accessible → Return DEFAULT_AVATAR
   - Else → Return stored URL

3. RETURN_URL:
   - Return {success: true, profilePictureURL: retrieved URL}
```

---

### 3.2 Utility Functions

#### Function: `generateUUID()`
**Purpose:** Create unique user IDs
**Logic:** Use Utilities.getUuid() or custom UUID implementation

#### Function: `generateVerificationToken(length: 32)`
**Purpose:** Create one-time email verification token
**Logic:** Generate random alphanumeric string, store with user record, set 24-hour expiry

#### Function: `generateJWT(userId, expiryHours: 24)`
**Purpose:** Create session token
**Logic:** Encode userId + expiry time, sign with secret key (stored in Google Apps Script Properties)

#### Function: `validateJWT(token)`
**Purpose:** Verify session token validity and expiry
**Logic:** Decode token, verify signature, check expiry time

#### Function: `hashPassword(password, saltRounds: 12)`
**Purpose:** Securely hash passwords
**Logic:** Use bcrypt algorithm or HMAC-SHA256 with salt

#### Function: `sendEmail(recipient, subject, htmlBody)`
**Purpose:** Send email notifications
**Logic:** Use MailApp.sendEmail() or GmailApp with HTML templates

---

## 4. FRONTEND COMPONENTS (React)

### 4.1 LOGIN FORM COMPONENT

**Props:**
```
{
    onLoginSuccess: (userId, sessionToken) => void,
    onForgotPassword: () => void,
    isLoading: boolean
}
```

**State:**
```
{
    username: string,
    password: string,
    showPassword: boolean,
    errors: {username?: string, password?: string, general?: string},
    isSubmitting: boolean,
    loginAttempts: number
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│         STUDENT LOGIN                   │
├─────────────────────────────────────────┤
│                                         │
│  Logo/Header                            │
│                                         │
│  Username Input Field                   │
│  ├─ Placeholder: "Enter username"       │
│  └─ Show error message if invalid       │
│                                         │
│  Password Input Field                   │
│  ├─ Type: password (toggle show/hide)   │
│  ├─ Show "Forgot Password?" link        │
│  └─ Show error message if invalid       │
│                                         │
│  [ Login Button ] (disabled while loading) │
│                                         │
│  Don't have account? [Register Here]    │
│                                         │
│  [Login as Guest]                       │
│                                         │
│  Error Message Display (if any)         │
│                                         │
└─────────────────────────────────────────┘
```

**Key Features:**
- Form validation on input (real-time feedback)
- Disable button while submitting
- Show loading spinner during submission
- Display backend error messages clearly
- Show password toggle icon
- Account lockout message if applicable
- Guest login option

---

### 4.2 REGISTER FORM COMPONENT

**Props:**
```
{
    onRegistrationSuccess: (userId) => void,
    onLoginClick: () => void
}
```

**State:**
```
{
    formData: {
        firstName, lastName, idCode, email, schoolEmail, birthday,
        major, year, section, username, password, confirmPassword,
        profilePicFile
    },
    fieldErrors: {[field]: string},
    passwordStrength: {strength: string, feedback: [string], passedChecks: {}},
    previewImageURL: string | null,
    isSubmitting: boolean,
    completionStep: number (1-4 for multi-step form)
}
```

**Layout (Multi-Step Form):**

**Step 1: Personal Information**
```
┌──────────────────────────────────────┐
│  Registration: Step 1/3              │
│  Personal Information                │
├──────────────────────────────────────┤
│                                      │
│  Profile Picture Upload              │
│  ┌─────────────────────────────────┐ │
│  │ [Drag to upload or click]       │ │
│  │ or select from computer         │ │
│  └─────────────────────────────────┘ │
│  [Image Preview if selected]         │
│                                      │
│  First Name *                        │
│  [Input field]                       │
│                                      │
│  Last Name *                         │
│  [Input field]                       │
│                                      │
│  Birthday (Optional)                 │
│  [Date picker]                       │
│                                      │
│  [Next] [Cancel]                     │
│                                      │
└──────────────────────────────────────┘
```

**Step 2: Academic Information**
```
┌──────────────────────────────────────┐
│  Registration: Step 2/3              │
│  Academic Information                │
├──────────────────────────────────────┤
│                                      │
│  School *                            │
│  [Read-only: University of...]       │
│                                      │
│  College *                           │
│  [Read-only: College of...]          │
│                                      │
│  Program *                           │
│  [Read-only: Bachelor of...]         │
│                                      │
│  Major * (Dropdown)                  │
│  ◼ Mathematics                        │
│  ◼ Filipino                           │
│  ◼ English                            │
│                                      │
│  Year * (Dropdown)                   │
│  ◼ 1st Year                           │
│  ◼ 2nd Year                           │
│  ...                                 │
│  ◼ 6th Year                           │
│                                      │
│  Section *                           │
│  [Input field] e.g., "A", "B1"       │
│                                      │
│  [Back] [Next] [Cancel]              │
│                                      │
└──────────────────────────────────────┘
```

**Step 3: Account & Email**
```
┌──────────────────────────────────────┐
│  Registration: Step 3/3              │
│  Account Setup & Verification        │
├──────────────────────────────────────┤
│                                      │
│  ID Code *                           │
│  [Input field]                       │
│  Error: "ID already registered" (if) │
│                                      │
│  Email * (Personal)                  │
│  [Input field] example@email.com     │
│  Error: "Email already registered"   │
│                                      │
│  School Email * (@deped.gov.ph)      │
│  [Input field]                       │
│  Error: "Invalid school email"       │
│                                      │
│  Username * (3-20 chars)             │
│  [Input field]                       │
│  ✓ Available / ✗ Already taken       │
│                                      │
│  Password * (Show requirements)      │
│  [Input field] [Show/Hide toggle]    │
│  ┌─ Length: ✓ ≥8 chars               │
│  ├─ Uppercase: ✗ Need A-Z            │
│  ├─ Lowercase: ✓ Has a-z             │
│  ├─ Number: ✗ Need 0-9               │
│  └─ Special: ✓ Has !@#$%^&*          │
│  Strength: Medium (color indicator)  │
│                                      │
│  Confirm Password *                  │
│  [Input field] [Show/Hide toggle]    │
│  Error: "Passwords don't match"      │
│                                      │
│  ☐ I agree to Terms of Service       │
│                                      │
│  [Back] [Register] [Cancel]          │
│                                      │
└──────────────────────────────────────┘
```

**Key Features:**
- Multi-step form with progress indicator
- Real-time field validation (show checkmarks/errors)
- Username availability check (debounced API call)
- Password strength meter with live feedback
- Profile picture preview before upload
- File drag-and-drop upload
- Confirm password matching
- Read-only school/college/program fields
- Terms of Service checkbox
- Back/Next/Cancel navigation
- Show helpful error messages

---

### 4.3 PROFILE PAGE COMPONENT

**Props:**
```
{
    userId: string,
    onLogout: () => void,
    onPasswordChange: () => void
}
```

**State:**
```
{
    userData: {} | null,
    isLoading: boolean,
    isEditMode: boolean,
    editFormData: {},
    editErrors: {},
    isSubmittingUpdate: boolean,
    successMessage: string | null,
    showPasswordModal: boolean
}
```

**Layout (Read Mode):**
```
┌───────────────────────────────────────────────┐
│           MY PROFILE                   [Edit] │
├───────────────────────────────────────────────┤
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │                                         │  │
│  │        [Profile Picture]                │  │
│  │        (Large Avatar)                   │  │
│  │                                         │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Account Information                          │
│  ├─ Username: @john_doe                       │
│  ├─ ID Code: 2024-001234                      │
│  └─ Email: john@example.com                   │
│                                               │
│  Personal Information                         │
│  ├─ Name: John David Doe                      │
│  ├─ Birthday: January 15, 1998                │
│  └─ School Email: john.doe@deped.gov.ph       │
│                                               │
│  Academic Information                         │
│  ├─ School: University of SE Philippines...   │
│  ├─ College: College of Teacher Education...  │
│  ├─ Program: Bachelor of Secondary Education  │
│  ├─ Major: Mathematics                        │
│  ├─ Year: 4th Year                            │
│  └─ Section: A                                │
│                                               │
│  Account Status                               │
│  ├─ Account Created: November 1, 2024         │
│  ├─ Last Login: Today at 10:30 AM             │
│  └─ Email Verified: ✓ Yes                     │
│                                               │
│  [Change Password] [Logout]                   │
│                                               │
└───────────────────────────────────────────────┘
```

**Layout (Edit Mode):**
```
┌───────────────────────────────────────────────┐
│           EDIT PROFILE                   [×]   │
├───────────────────────────────────────────────┤
│                                               │
│  Profile Picture                              │
│  ┌─────────────────────────────────────────┐  │
│  │        [Current Picture]      [Change]  │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Personal Information                         │
│  First Name *                                 │
│  [Input: John]                                │
│                                               │
│  Last Name *                                  │
│  [Input: Doe]                                 │
│                                               │
│  Birthday (Optional)                          │
│  [Date picker: January 15, 1998]              │
│                                               │
│  School Email *                               │
│  [Input: john.doe@deped.gov.ph]               │
│  [Verification status indicator]              │
│                                               │
│  Academic Information                         │
│  Major * (Dropdown)                           │
│  [Dropdown: Mathematics]                      │
│                                               │
│  Year * (Dropdown)                            │
│  [Dropdown: 4th Year]                         │
│                                               │
│  Section *                                    │
│  [Input: A]                                   │
│                                               │
│  [Read-only fields shown as grey text]        │
│                                               │
│  [Save Changes] [Cancel]                      │
│                                               │
│  Success: "Profile updated successfully"      │
│                                               │
└───────────────────────────────────────────────┘
```

**Key Features:**
- Display all user information clearly organized
- Two modes: Read-only and Edit
- Edit button to toggle edit mode
- Editable fields: firstName, lastName, birthday, major, year, section, schoolEmail, profilePicture
- Read-only fields: username, idCode, email, school, college, program, createdDate
- Profile picture change with preview
- Separate "Change Password" button/modal
- Show account status and metadata
- Save/Cancel buttons in edit mode
- Success/error message displays
- Logout button
- Account activity display (last login, email verification status)

---

### 4.4 GUEST USER PROMPT COMPONENT

**Props:**
```
{
    onLogin: () => void,
    onRegister: () => void,
    onDismiss: () => void,
    actionCount: number,
    actionLimit: number
}
```

**State:**
```
{
    showPrompt: boolean,
    dismissedCount: number (track dismissals)
}
```

**Layout (Modal):**
```
┌──────────────────────────────────────────────────┐
│                                              [×]  │
│         LIMITED GUEST ACCESS                     │
├──────────────────────────────────────────────────┤
│                                                  │
│  You've used 5 of 5 available guest actions      │
│                                                  │
│  To continue exploring exam schedules and        │
│  register for exams, please create an account    │
│  or login with your existing credentials.        │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Features Locked for Guests:              │   │
│  │ • View detailed exam information         │   │
│  │ • Register for exams                     │   │
│  │ • Access exam reminders                  │   │
│  │ • Track exam history                     │   │
│  │ • Save favorite exams                    │   │
│  │ • Receive notifications                  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [Create Account] [Login]                       │
│                                                  │
│  Continue as Guest? [Cancel]                    │
│  (Dismisses modal, can act until session exp)   │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Variants:**
1. **Hard Block** (After action limit): Modal cannot be dismissed, forces login/register
2. **Soft Prompt** (After 3 actions): Modal can be dismissed, warning only
3. **Session Expiry**: When 24-hour guest session expires

**Key Features:**
- Show action counter (X of Y used)
- List features locked for guests
- Two CTAs: Create Account, Login
- Optional dismiss button (unless hard block)
- Different messaging based on trigger (action limit vs session expiry)
- Clear, friendly tone encouraging registration
- Track dismissals to avoid showing too often

---

## 5. SECURITY CONSIDERATIONS

### Password Security
- Store only password hashes (bcrypt with 12 rounds minimum)
- Never log or transmit passwords in plaintext
- Implement password strength requirements
- Enforce password changes on suspicious activity

### Session Management
- Use JWT tokens with 24-hour expiry
- Include token in HTTP-only cookies or Authorization header
- Validate token on every protected request
- Invalidate all sessions on password change

### Account Protection
- Lock account after 5 failed login attempts (30-minute lockout)
- Implement CAPTCHA after 3 failed attempts (optional)
- Log all login attempts with timestamps
- Send security alerts for suspicious activity
- Implement email verification for new accounts

### Data Protection
- Use HTTPS only for all connections
- Validate and sanitize all inputs (prevent SQL injection, XSS)
- Implement CORS properly
- Rate limit authentication endpoints (max 10 requests/minute per IP)
- Encrypt sensitive data at rest

### Audit & Compliance
- Log all authentication events (login, registration, password change, profile updates)
- Track profile modifications with before/after values
- Store logs separately from main database
- Implement data retention policies

---

## 6. API ENDPOINTS (Backend)

### Authentication Endpoints
```
POST /api/auth/register
- Body: userData + profilePicFile
- Response: {success, userId, message, fieldErrors}

POST /api/auth/login
- Body: {username, password}
- Response: {success, userId, sessionToken, userData}

POST /api/auth/logout
- Headers: {Authorization: Bearer sessionToken}
- Response: {success, message}

POST /api/auth/verify-email
- Body: {token}
- Response: {success, message}

POST /api/auth/forgot-password
- Body: {email}
- Response: {success, message}

POST /api/auth/reset-password
- Body: {token, newPassword}
- Response: {success, message}
```

### Validation Endpoints
```
GET /api/validate/username/:username
- Response: {available: boolean, error}

POST /api/validate/password-strength
- Body: {password}
- Response: {strength, feedback, passedChecks}

GET /api/validate/email/:email
- Response: {available: boolean, error}
```

### User Profile Endpoints
```
GET /api/users/:userId
- Headers: {Authorization: Bearer sessionToken}
- Response: {success, user}

PUT /api/users/:userId
- Headers: {Authorization: Bearer sessionToken}
- Body: {updatedData}
- Response: {success, updatedUser, message}

POST /api/users/:userId/change-password
- Headers: {Authorization: Bearer sessionToken}
- Body: {currentPassword, newPassword}
- Response: {success, message}

GET /api/users/:userId/profile-picture
- Response: {success, profilePictureURL}
```

---

## 7. DATABASE QUERIES (Google Sheets / Firebase)

### Common Queries

**Find user by username:**
```sql
SELECT * FROM Users WHERE username = {username}
```

**Find user by email:**
```sql
SELECT * FROM Users WHERE email = {email} OR schoolEmail = {email}
```

**Check username availability:**
```sql
SELECT COUNT(*) FROM Users WHERE username = {username}
```

**Get user profile (filtered):**
```sql
SELECT userId, firstName, lastName, profilePictureURL, email, schoolEmail, 
       major, year, section, college, program, lastLogin, createdDate, emailVerified
FROM Users WHERE userId = {userId}
```

**Update last login:**
```sql
UPDATE Users SET lastLogin = {NOW} WHERE userId = {userId}
```

**Lock account after failed attempts:**
```sql
UPDATE Users SET accountLocked = true, lockedUntil = {NOW + 30 min} 
WHERE userId = {userId}
```

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1: Core Authentication (Week 1-2)
- [ ] Design Users sheet/table
- [ ] Implement registerUser() function
- [ ] Implement loginUser() function
- [ ] Implement password hashing
- [ ] Create LoginForm component
- [ ] Create RegisterForm component

### Phase 2: Account Security (Week 2-3)
- [ ] Implement account lockout logic
- [ ] Add password strength validation
- [ ] Implement email verification
- [ ] Add password reset functionality
- [ ] Implement session token management

### Phase 3: Profile Management (Week 3-4)
- [ ] Implement updateUserProfile() function
- [ ] Create ProfilePage component
- [ ] Add password change workflow
- [ ] Implement profile picture upload to Google Drive
- [ ] Add edit profile functionality

### Phase 4: Guest User System (Week 4)
- [ ] Implement guest session tracking
- [ ] Create GuestUserPrompt component
- [ ] Implement action limiting
- [ ] Add session expiry handling

### Phase 5: Testing & Polish (Week 5)
- [ ] Unit tests for validation functions
- [ ] Integration tests for auth flows
- [ ] Security audit
- [ ] Performance optimization
- [ ] UI/UX refinement

---

## 9. VALIDATION RULES SUMMARY

### Username
- Min length: 3 characters
- Max length: 20 characters
- Pattern: `^[a-zA-Z0-9_]+$` (alphanumeric + underscore)
- Must be unique

### Password
- Min length: 8 characters
- Must contain: 1 uppercase, 1 lowercase, 1 number, 1 special character
- Cannot contain username or email fragments
- Must not match last 3 passwords (if changing)

### Email
- Valid email format: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- Must be unique
- Must be verified before account fully activated

### School Email
- Must match institutional domain (e.g., @deped.gov.ph)
- Must be unique
- Optional verification via LDAP/institution directory

### Name Fields
- Min length: 2 characters
- Max length: 100 characters
- Pattern: Allow letters, spaces, hyphens, apostrophes

### ID Code
- Format: Numeric or alphanumeric
- Must be unique
- Length: 8-20 characters

### Date Fields
- Format: YYYY-MM-DD
- Birthday: Must be 16+ years old
- Future dates not allowed

---

## 10. ERROR HANDLING & MESSAGES

### User-Friendly Error Messages

| Scenario | Message |
|----------|---------|
| Username taken | "Username already taken. Try a different one." |
| Email registered | "Email is already registered to an account." |
| Invalid credentials | "Username or password is incorrect." |
| Account locked | "Account locked due to multiple failed attempts. Try again in 30 minutes." |
| Weak password | "Password doesn't meet requirements. [Show details]" |
| Password mismatch | "Passwords don't match. Please try again." |
| Email not verified | "Please verify your email before logging in." |
| Session expired | "Your session expired. Please log in again." |
| Network error | "Connection error. Please check your internet and try again." |
| Server error | "Something went wrong. Please try again later." |

---

## CONCLUSION

This authentication system provides:
- **Secure** password handling and session management
- **Flexible** support for both regular and guest users
- **Comprehensive** profile management with role-based field access
- **User-friendly** multi-step registration and validation
- **Enterprise-grade** security with account lockout and audit logging
- **Scalable** architecture using Google Apps Script backend and React frontend
