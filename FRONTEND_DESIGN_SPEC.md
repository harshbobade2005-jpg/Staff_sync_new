# StaffSync — Frontend UI/UX Design & Stitch Blueprint

This document contains the complete, pixel-accurate blueprint of the **StaffSync Modern HRM System** frontend. It specifies every screen, layout structure, color token, typography standard, data table, modal, input field, and interactive button so that you can design and reconstruct the entire interface on **Google Stitch**, **Figma**, or any modern UI tool.

---

## 🎨 1. Design System & Visual Tokens

### 1.1 Color Palette

| Token Name | HEX Code | RGB | Role / Usage |
|---|---|---|---|
| `--bs-primary` | `#4F46E5` | `79, 70, 229` | Primary brand action, active sidebar links, submit buttons, badges |
| `--bs-primary-hover`| `#4338CA` | `67, 56, 202` | Primary hover state |
| `--bs-primary-subtle`| `#EEF2FF` | `238, 242, 255`| Soft primary background for badges, active chips, icon wrappers |
| `--bs-success` | `#16A34A` | `22, 163, 74` | "Approved", "Present", "Active", positive actions |
| `--bs-success-subtle`| `#DCFCE7` | `220, 252, 231`| Success badges, notification alerts |
| `--bs-warning` | `#D97706` | `217, 119, 6` | "Pending", "Late Arrival", "Holiday", attention markers |
| `--bs-warning-subtle`| `#FEF3C7` | `254, 243, 199`| Warning badges and preview callouts |
| `--bs-danger` | `#DC2626` | `220, 38, 38` | "Rejected", "Absent", "Deactivate", destructive actions |
| `--bs-danger-subtle`| `#FEE2E2` | `254, 226, 226`| Danger badges and error banners |
| `--bs-info` | `#0284C7` | `2, 132, 199` | "Half-Day", info alerts, manager badges |
| `--bs-info-subtle` | `#E0F2FE` | `224, 242, 254`| Soft info background |
| `--bs-body-bg` | `#F5F7FB` | `245, 247, 251`| Main app background (soft slate/cool gray) |
| `--bs-card-bg` | `#FFFFFF` | `255, 255, 255`| Card, table, and modal background |
| `--bs-body-color` | `#1F2937` | `31, 41, 55` | Primary headings, dark body text (slate-800) |
| `--bs-secondary-color`| `#6B7280`| `107, 114, 128`| Subtitles, timestamps, muted labels (gray-500) |
| `--bs-border-color`| `#E5E7EB` | `229, 231, 235`| Dividers, table borders, card outlines (gray-200) |

### 1.2 Typography & Sizing

- **Font Family**: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- **Headings Font Weight**: `600` (Semi-bold) / `700` (Bold)
- **Body Font Size**: `15px (0.9375rem)` / Weight: `400`
- **Tabular Numerals**: `font-variant-numeric: tabular-nums` (applied to all counts, balances, timers, and data table numerical columns)
- **Type Scale**:
  - `Display / H1`: `28px (1.75rem)` — Bold (`700`)
  - `H2 (Section Header)`: `20px (1.25rem)` — Semi-bold (`600`)
  - `H3 / Card Header`: `16px (1.0rem)` — Semi-bold (`600`)
  - `Body / Subtitle`: `14px (0.875rem)` — Regular (`400`)
  - `Caption / Badge`: `11px - 12px (0.6875rem - 0.75rem)` — Medium (`500`) / Bold (`700`)

### 1.3 Elevation, Radii & Shadows

- **Border Radii**:
  - Inputs & Small Buttons (`--bs-border-radius-sm`): `6px (0.375rem)`
  - Standard Cards & Modals (`--bs-border-radius`): `10px (0.625rem)`
  - Large Banners / Hero Cards (`--bs-border-radius-lg`): `14px (0.875rem)`
  - Avatars & Badges: Pill `9999px`
- **Shadows**:
  - Card Shadow: `0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)`
  - Card Hover: `0 4px 6px rgba(16, 24, 40, 0.07), 0 2px 4px rgba(16, 24, 40, 0.06)`
  - Modal / Dropdown Shadow: `0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06)`

---

## 🏛️ 2. Global Shell & Layout Structure

The application has two global shell layouts:
1. **`AuthLayout`** (Public unauthenticated screens)
2. **`AppLayout`** (Authenticated workspace screens)

```
┌────────────────────────────────────────────────────────────────────────┐
│ APP SHELL LAYOUT (Desktop View - 1440px / 1920px)                      │
├──────────────────┬─────────────────────────────────────────────────────┤
│ SIDEBAR (260px)  │ TOPBAR (Sticky Header, Height: 64px)                │
│ [Logo] StaffSync │ [Dept Icon + Dept Name]         [Avatar Dropdown ▼] │
│ HRM SYSTEM       ├─────────────────────────────────────────────────────┤
│                  │ MAIN CONTENT AREA (Padded 24px/32px, Scrollable)    │
│ MENU ({ROLE})    │  Breadcrumb: Dashboard / Current Page               │
│ • Dashboard      │  PageHeader: [Page Title]    [Primary CTA Button]   │
│ • Employees      │              [Page Subtitle] [Secondary Button]     │
│ • Departments    │ ─────────────────────────────────────────────────── │
│ • Directory      │  Content Grid / Stat Cards / Charts / Data Tables   │
│ • Leave Requests │                                                     │
│ • Leave Settings │                                                     │
│ • Attendance     │                                                     │
│ • Training       │                                                     │
│ • Announcements  │                                                     │
│ • My Profile     │                                                     │
│ ──────────────── │                                                     │
│ [Avatar] User    │                                                     │
│ [Role Badge]     │                                                     │
└──────────────────┴─────────────────────────────────────────────────────┘
```

### 2.1 Desktop Sidebar Component (`AppLayout`)
- **Width**: `260px` fixed, full height (`100vh`), white background, `border-end: 1px solid #e5e7eb`.
- **Top Header**:
  - Indigo icon box (`38x38px`, background `#4F46E5`, rounded `8px`, white `bi-people-fill` icon).
  - Text: **StaffSync** (Bold `16px`), subtitle `HRM SYSTEM` (Uppercase `11px`, letter-spacing `0.05em`, color `#6b7280`).
- **Navigation Links Group**:
  - Section label: `MENU (HR)`, `MENU (MANAGER)`, or `MENU (EMPLOYEE)` (`11px` bold uppercase muted).
  - Link Items (Vertical list, gap `4px`):
    - Inactive: Gray icon (`20px`), gray text (`14px` medium), hover background `#f8fafc`.
    - Active: Solid Indigo background `#4F46E5`, crisp white icon and text, soft shadow, rounded `8px`.
- **Bottom User Profile Card**:
  - Avatar circle (`36x36px`, Indigo background, white uppercase user initials).
  - Name: Truncated bold text (`13px`).
  - Role Badge: Pill badge (`ROLE_COLORS`: HR is blue/purple, Manager is cyan/info, Employee is gray/secondary).

### 2.2 Topbar Navbar Component
- **Height**: `60px`, background `#ffffff`, border bottom `1px solid #e5e7eb`, sticky top.
- **Left Element**: Department indicator pill with building icon (e.g., `🏢 Human Resources` or `🏢 Engineering`).
- **Mobile Left**: Hamburger menu icon button (`bi-list`) to trigger the mobile offcanvas drawer.
- **Right Element**: User Account Dropdown:
  - Trigger button: Pill avatar with user initials, name label, and chevron down (`bi-chevron-down`).
  - Dropdown Menu:
    - User Info header: Full name & email address.
    - Divider.
    - Item 1: `👤 My Profile` (navigates to `/profile`).
    - Item 2: `🔑 Change Password` (navigates to `/change-password`).
    - Divider.
    - Item 3: `🚪 Sign Out` (Red text, executes logout, redirects to `/login`).

---

## 📄 3. Detailed Page & Screen Catalog

---

### Page 1: Login Screen (`/login`)
- **Role Access**: Public / Unauthenticated
- **Purpose**: Authenticates HR, Managers, and Employees with email and password, or allows one-click demo role switching.

#### Visual Layout:
- Centered card (`width: 440px`), elevated shadow, on a soft background (`#f5f7fb`).
- Top branding: StaffSync logo icon, title "Welcome to StaffSync", subtitle "Enterprise Human Resource Management".
- Email field, Password field (with show/hide eye toggle), "Remember me" checkbox.
- Big submit button: **Sign In to Account**.
- Quick Demo Login Selector: 3 quick-switch pill buttons for instant demo credentials fill (`HR Admin`, `Manager`, `Employee`).
- Security notice in footer.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Sign In to Account** | `btn-primary` (Full width, 44px height) | `bi-box-arrow-in-right` | Bottom of login form | Validates inputs, calls `POST /api/auth/login`, redirects by role |
| **Password Visibility** | `btn-outline-secondary` (Input group append) | `bi-eye` / `bi-eye-slash` | Inside password field | Toggles input type between `password` and `text` |
| **HR Admin** | `btn-outline-primary btn-sm` (Pill chip) | `bi-shield-check` | Demo accounts panel | Auto-fills `hr@staffsync.test` / `Passw0rd!23` |
| **Manager** | `btn-outline-info btn-sm` (Pill chip) | `bi-person-badge` | Demo accounts panel | Auto-fills `manager@staffsync.test` / `Passw0rd!23` |
| **Employee** | `btn-outline-secondary btn-sm` (Pill chip)| `bi-person` | Demo accounts panel | Auto-fills `employee1@staffsync.test` / `Passw0rd!23` |

---

### Page 2: Change Password Screen (`/change-password`)
- **Role Access**: Authenticated (All Roles)
- **Purpose**: Update current account password or complete mandatory first-time password rotation.

#### Visual Layout:
- Centered security card (`460px` max-width).
- Header: Shield lock icon, title "Security & Password Update".
- Inputs: Current Password, New Password, Confirm New Password.
- Real-time password requirement checklist: (Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char).

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Update Password** | `btn-primary` (Full width) | `bi-check2-circle` | Form submit | Calls `POST /api/auth/change-password`, logs user out to re-authenticate |
| **Cancel / Back** | `btn-light` (Full width) | `bi-arrow-left` | Below submit button | Returns to dashboard |

---

### Page 3: HR Executive Dashboard (`/hr`)
- **Role Access**: HR Admin (`hr`)
- **Purpose**: Executive overview of company workforce, attendance pulse, leave pipeline, and skill development.

#### Visual Layout:
- **Hero Welcome Banner**: Blue/Indigo gradient background (`#4F46E5`), white text, displays HR Manager name, department, employee code, and quick-action buttons.
- **Top Metrics Row (4 Stat Cards)**:
  1. *Total Headcount*: Total active employees with team icon (`bi-people`).
  2. *Present Today*: Live count of checked-in staff with check icon (`bi-person-check`).
  3. *On Leave*: Employees with active approved leave today with calendar icon (`bi-calendar-event`).
  4. *Org Skill Proficiency*: Average training completion % with cap icon (`bi-mortarboard`).
- **Charts Row (2 Columns)**:
  - Left Card: **Department Headcount Distribution** (Accessible SVG vertical bar chart with member count tooltips).
  - Right Card: **Leave Status Distribution** (Donut / Segment chart showing Pending vs Approved vs Rejected requests).
- **Bottom Row (2 Columns)**:
  - Left Card: **Recent Workforce Activity** (List of recent employee hires and status updates).
  - Right Card: **Quick Navigation shortcuts** to Attendance Logs, Workforce Roster, and Announcements.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Attendance Logs** | `btn-outline-light btn-sm` (Pill) | `bi-clock-history` | Inside Hero Banner | Navigates to `/attendance` |
| **Workforce** | `btn-light text-primary btn-sm` (Pill)| `bi-people` | Inside Hero Banner | Navigates to `/employees` |
| **View Units →** | `btn-outline-secondary btn-sm` | None | Headcount Chart header | Navigates to `/departments` |
| **Requests →** | `btn-outline-secondary btn-sm` | None | Leave Chart header | Navigates to `/leaves/requests` |

---

### Page 4: Employee Workforce Directory & Management (`/employees`)
- **Role Access**: HR Admin (`hr`)
- **Purpose**: Search, filter, onboard new staff, and manage employee employment records.

#### Visual Layout:
- **PageHeader**:
  - Title: "Employee Directory & Workforce"
  - Subtitle: "Complete record of employees, reporting lines, and access privileges"
  - Action: **+ Add Employee** button.
- **Search & Filter Bar**:
  - Live Search Input (`Search by name, email, code...`)
  - Department dropdown filter (`All`, `Engineering`, `HR`, `Sales`, `Finance`)
  - Role dropdown filter (`All`, `Employee`, `Manager`, `HR`)
  - Status dropdown filter (`All`, `Active`, `Deactivated`)
- **Data Table**:
  - Columns: `Employee Code`, `Employee (Avatar + Name + Email)`, `Department`, `Reporting Manager`, `Role Badge`, `Status Badge`, `Actions (Dropdown)`.
  - Pagination bar: Page indicator, Items per page, Next/Previous controls.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Add Employee** | `btn-primary` | `bi-plus-lg` | Top right PageHeader | Opens `AddEmployeeModal` drawer |
| **Action Menu (•••)**| `btn-light btn-sm` | `bi-three-dots-vertical` | Each table row | Opens contextual dropdown menu |
| **View Profile** | Dropdown item | `bi-eye` | Inside row action menu | Navigates to `/employees/:id` |
| **Edit Details** | Dropdown item | `bi-pencil` | Inside row action menu | Opens `EditEmployeeModal` for that row |
| **Reset Password** | Dropdown item | `bi-key` | Inside row action menu | Opens `ResetPasswordModal` |
| **Deactivate / Activate**| Dropdown item (Red if deact) | `bi-slash-circle` | Inside row action menu | Opens `ConfirmModal` for status toggle |
| **Previous Page** | `btn-outline-secondary btn-sm` | `bi-chevron-left` | Table pagination | Loads previous page records |
| **Next Page** | `btn-outline-secondary btn-sm` | `bi-chevron-right`| Table pagination | Loads next page records |

#### Modal 1: `EmployeeFormModal` (Add / Edit Employee)
- **Inputs**:
  - Full Name (`text`, required)
  - Work Email (`email`, required)
  - Department (`select`, list of active departments)
  - Role (`select`: `employee`, `manager`, `hr`)
  - Designation / Job Title (`text`, required, e.g. "Senior Software Engineer")
  - Reporting Manager (`select`, filtered list of managers)
  - Date of Joining (`date picker`)
- **Buttons**:
  - **Cancel**: `btn-outline-secondary` (Closes modal without saving)
  - **Save Employee**: `btn-primary` (Validates and submits `POST /api/employees` or `PUT /api/employees/:id`)

#### Modal 2: `ResetPasswordModal`
- **Inputs**:
  - Temporary Password input or "Generate Secure Password" helper.
- **Buttons**:
  - **Generate Random**: `btn-outline-secondary btn-sm`
  - **Confirm Reset**: `btn-warning` (Executes password reset and revokes user sessions)
  - **Cancel**: `btn-light`

---

### Page 5: Employee Detail & Profile Tabs (`/employees/:id`)
- **Role Access**: HR Admin (`hr`), Manager (`manager` for direct reports), Employee (`employee` self view)
- **Purpose**: Deep 360-degree profile view with personal records, leave quotas, attendance history, and training completions.

#### Visual Layout:
- **Profile Header Card**:
  - Large avatar circle, Full Name, Designation, Department badge, Employee Code, Status pill.
  - Action buttons: `Edit Profile`, `Reset Password`, `Deactivate Account`.
- **Tab Navigation**:
  - Tab 1: **Overview & Job Details** (Contact info, Joining date, Reporting manager line).
  - Tab 2: **Leave Balances & History** (Quota cards for Casual, Sick, Earned, Unpaid; Adjust Balance button for HR).
  - Tab 3: **Attendance Logs** (Last 30-day attendance timeline and statistics).
  - Tab 4: **Trainings & Skills** (Enrolled courses, completion percentage, manager evaluation scores).

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Edit Profile** | `btn-outline-secondary btn-sm` | `bi-pencil` | Profile Header | Opens `EmployeeFormModal` |
| **Reset Password** | `btn-outline-warning btn-sm` | `bi-key` | Profile Header | Opens `ResetPasswordModal` |
| **Deactivate Account**| `btn-outline-danger btn-sm` | `bi-slash-circle` | Profile Header | Opens `ConfirmModal` (immediate session kill) |
| **Adjust Balance** | `btn-primary btn-sm` | `bi-sliders` | Tab 2 (Leaves) header | Opens `AdjustBalanceModal` (HR only) |
| **Back to Workforce** | `btn-link` | `bi-arrow-left` | Page breadcrumb | Navigates back to `/employees` |

#### Modal: `AdjustBalanceModal`
- **Inputs**:
  - Leave Type (`select`: Casual, Sick, Earned, Unpaid)
  - Adjustment Type (`select`: Add Days `+`, Deduct Days `-`, Set Fixed Value `=`)
  - Number of Days (`number`, e.g. `2.5`)
  - Mandatory Audit Reason (`textarea`, required, e.g. "Approved compensatory off for weekend rollout")
- **Buttons**:
  - **Cancel**: `btn-outline-secondary`
  - **Apply Balance Adjustment**: `btn-primary`

---

### Page 6: Department Management (`/departments`)
- **Role Access**: HR Admin (`hr`)
- **Purpose**: Structure business units, assign department heads, and monitor department headcount.

#### Visual Layout:
- **PageHeader**:
  - Title: "Departments"
  - Subtitle: "Organize company structure and departmental leadership"
  - Action: **+ Add Department** button.
- **Departments Grid / Table**:
  - Columns: `Department Code (Pill)`, `Department Name & Description`, `Department Head`, `Total Employees (Pill badge)`, `Actions`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Add Department** | `btn-primary` | `bi-plus-lg` | Top right PageHeader | Opens `DepartmentModal` (Create) |
| **Edit** | `btn-outline-secondary btn-sm` | `bi-pencil` | Table row action | Opens `DepartmentModal` (Edit) |
| **Delete** | `btn-outline-danger btn-sm` | `bi-trash` | Table row action | Opens `ConfirmModal` (Blocked if employees assigned) |

#### Modal: `DepartmentModal`
- **Inputs**:
  - Department Name (`text`, required, e.g. "Product Design")
  - Department Code (`text`, required, e.g. "DES")
  - Description (`textarea`, optional)
  - Department Head (`select`, optional manager selection)
- **Buttons**:
  - **Cancel**: `btn-outline-secondary`
  - **Save Department**: `btn-primary`

---

### Page 7: Leave Requests Oversight (`/leaves/requests`)
- **Role Access**: HR Admin (`hr`)
- **Purpose**: Organization-wide leave application queue, emergency escalations, and audit history.

#### Visual Layout:
- **Status Filter Chips**: `All Requests`, `Pending`, `Approved`, `Rejected`, `Cancelled`.
- **Search Input**: Filter by employee name or code.
- **Requests Table**:
  - Columns: `Employee (Avatar + Name)`, `Leave Type`, `Dates (Start → End)`, `Working Days (Tabular badge)`, `Reason`, `Applied On`, `Status`, `Actions`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Approve** | `btn-success btn-sm` | `bi-check-lg` | Row action (if pending) | Opens `LeaveDecisionModal` with approval notes |
| **Reject** | `btn-danger btn-sm` | `bi-x-lg` | Row action (if pending) | Opens `LeaveDecisionModal` with mandatory rejection comment |
| **Export Report** | `btn-outline-secondary btn-sm` | `bi-download` | Table top toolbar | Downloads filtered leaves as Excel-safe CSV |

---

### Page 8: Leave Settings & Policies (`/leaves/settings`)
- **Role Access**: HR Admin (`hr`)
- **Purpose**: Configure annual quotas, paid/unpaid leave rules, and official company holiday schedules.

#### Visual Layout:
- Two Column / Split Section:
  - **Section A: Leave Types & Annual Quotas**:
    - Cards for Casual Leave (`12 days`), Sick Leave (`10 days`), Earned Leave (`15 days`), Unpaid Leave (`Unlimited`).
    - Action: **+ Add Leave Type**.
  - **Section B: Official Company Holidays**:
    - Table of official holidays with dates and day of week.
    - Action: **+ Add Holiday**.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Add Leave Type** | `btn-primary btn-sm` | `bi-plus-lg` | Leave Types card header | Opens `LeaveTypeModal` |
| **Edit Policy** | `btn-outline-secondary btn-sm`| `bi-pencil` | Leave type item row | Edits quota & paid settings |
| **Add Holiday** | `btn-primary btn-sm` | `bi-plus-lg` | Holidays card header | Opens `HolidayModal` |
| **Delete Holiday** | `btn-outline-danger btn-sm` | `bi-trash` | Holiday row | Removes holiday date |

---

### Page 9: Organization Attendance Management (`/attendance`)
- **Role Access**: HR Admin (`hr`)
- **Purpose**: Live clock monitoring, manual check-in/out corrections, and Excel-safe CSV export.

#### Visual Layout:
- **Top Stats Bar**:
  - Present Count, Late Arrivals Count, Half-Day Count, Absent Count.
- **Filter Toolbar**:
  - Date Picker (Defaults to today)
  - Department selector
  - Status selector
  - **Export CSV** button
- **Attendance Records Table**:
  - Columns: `Employee`, `Department`, `Date`, `Check In Time`, `Check Out Time`, `Work Duration`, `Status Badge (Present, Late, Half-Day, Absent)`, `Audit Notes`, `Actions`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Export Attendance CSV**| `btn-success btn-sm` | `bi-file-earmark-spreadsheet`| Toolbar right | Generates formula-injection escaped CSV |
| **Edit Record** | `btn-outline-secondary btn-sm` | `bi-pencil-square` | Row action | Opens `AttendanceCorrectionModal` |

#### Modal: `AttendanceCorrectionModal`
- **Inputs**:
  - Check-in Timestamp (`datetime-local`)
  - Check-out Timestamp (`datetime-local`)
  - Mandatory Correction Reason (`textarea`, required, e.g. "Biometric scanner failure during entry")
- **Buttons**:
  - **Cancel**: `btn-outline-secondary`
  - **Save Correction**: `btn-primary`

---

### Page 10: Announcements Management (`/announcements/manage`)
- **Role Access**: HR Admin (`hr`)
- **Purpose**: Author, target, pin, and publish official company announcements.

#### Visual Layout:
- **Authoring Card (Top)**:
  - Title input (`text`)
  - Target Audience selector (`All Employees`, `Employees Only`, `Managers Only`, `HR Only`)
  - Priority selector (`Normal`, `Urgent`, `Critical`)
  - Pin to Top checkbox toggle
  - Rich / Plain Text Content area
  - Action: **Publish Announcement** button.
- **Published Feed (Bottom)**:
  - List of active announcements with badge tags, author name, timestamp, pin indicators.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Publish Announcement** | `btn-primary` | `bi-send` | Authoring form bottom | Submits `POST /api/announcements` |
| **Pin / Unpin** | `btn-outline-secondary btn-sm` | `bi-pin-angle` | Announcement card | Toggles sticky pinned status |
| **Delete** | `btn-outline-danger btn-sm` | `bi-trash` | Announcement card | Permanently deletes announcement |

---

### Page 11: Manager Team Pulse & Dashboard (`/manager`)
- **Role Access**: People Manager (`manager`, `hr`)
- **Purpose**: Operational dashboard for team attendance, pending leave approvals, and direct reports.

#### Visual Layout:
- **Team Stat Counters**:
  - Direct Reports Count, Team Present Today, Pending Leave Approvals (Orange alert badge), Enrolled in Training.
- **Pending Approvals Quick Card**:
  - Mini-table of direct report leave requests needing action.
- **Today's Team Attendance Board**:
  - Real-time status cards of who is checked in, who is late, and who is on leave.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Review All Approvals**| `btn-outline-primary btn-sm` | `bi-arrow-right` | Approvals card header | Navigates to `/leaves/approvals` |
| **Quick Approve** | `btn-success btn-sm` | `bi-check` | Pending item action | Approves leave request directly |
| **Quick Reject** | `btn-outline-danger btn-sm` | `bi-x` | Pending item action | Rejects leave request with note |

---

### Page 12: Manager My Team Directory (`/team`)
- **Role Access**: People Manager (`manager`, `hr`)
- **Purpose**: Scoped directory of direct reports with reporting details and quick performance links.

#### Visual Layout:
- Grid of Employee Profile Cards:
  - Avatar, Name, Designation, Work Email, Employee Code.
  - Quick badges: Current leave balance, Today's attendance status.
  - Action buttons: `View Profile`, `View Leaves`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **View Profile** | `btn-outline-primary btn-sm` | `bi-person` | Card footer | Navigates to `/employees/:id` |
| **Attendance History** | `btn-light btn-sm` | `bi-clock-history` | Card footer | Views member attendance log |

---

### Page 13: Manager Team Leave Approvals (`/leaves/approvals`)
- **Role Access**: People Manager (`manager`, `hr`)
- **Purpose**: Review pending team leave requests with holiday/weekend deductions preview.

#### Visual Layout:
- **Filter Tabs**: `Pending Approvals (Badge Count)`, `Approval History`.
- **Leave Request Review Cards**:
  - Applicant Name + Avatar + Designation.
  - Leave Type (Casual / Sick / Earned / Unpaid).
  - Date Range (e.g., `Oct 28, 2026 → Oct 30, 2026`).
  - Total Calculated Working Days (Automatic deduction of official holidays and weekends).
  - Applicant's Reason text.
  - Current Available Balance preview (e.g. `Available: 8.0 days`).
  - Actions: **Approve Leave**, **Reject Leave**.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Approve Request** | `btn-success` | `bi-check-circle` | Approval Card right | Calls `PATCH /api/leaves/:id/approve` |
| **Reject Request** | `btn-danger` | `bi-x-circle` | Approval Card right | Opens comment dialog then calls `PATCH /api/leaves/:id/reject` |

---

### Page 14: Manager Team Daily Attendance Board (`/attendance/team`)
- **Role Access**: People Manager (`manager`, `hr`)
- **Purpose**: Scoped daily team attendance roster with status filters.

#### Visual Layout:
- **Date Selector**: (Defaults to today, allows navigating previous days).
- **Status Filter Pills**: `All`, `Present`, `Late`, `On Leave`, `Not Checked In`.
- **Roster Table**:
  - Columns: `Employee`, `Designation`, `Check-In Time`, `Check-Out Time`, `Hours Worked`, `Status Badge`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Previous Day** | `btn-outline-secondary btn-sm` | `bi-chevron-left` | Date selector | Moves date backward 1 day |
| **Next Day** | `btn-outline-secondary btn-sm` | `bi-chevron-right`| Date selector | Moves date forward 1 day |
| **Today** | `btn-light btn-sm` | `bi-calendar-event` | Date selector | Resets date to today |

---

### Page 15: Employee Self-Service Dashboard (`/employee`)
- **Role Access**: Employee (`employee`, `manager`, `hr`)
- **Purpose**: Personal portal for daily clock in/out, available leaves, company news, and skills.

#### Visual Layout:
- **Hero Card with Live Clock Widget (`AttendanceWidget`)**:
  - Live ticking digital clock (`HH:MM:SS AM/PM`) and date.
  - Big Check-In / Check-Out Action Button.
  - Today's Status Badge (`Not Checked In`, `Present`, `Late`, `Checked Out`).
  - Elapsed hours counter (`e.g. 5h 22m worked today`).
- **Middle Section (Leave Balances Snapshot)**:
  - 4 Quota Cards (Casual, Sick, Earned, Unpaid) showing Available vs Total.
  - Action button: **+ Apply for Leave**.
- **Bottom Section**:
  - Company Announcements preview bulletin.
  - Enrolled Training progress cards.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Check In** | `btn-success btn-lg` (Large CTA) | `bi-box-arrow-in-right` | Clock widget | Calls `POST /api/attendance/check-in` |
| **Check Out** | `btn-danger btn-lg` (Large CTA) | `bi-box-arrow-right` | Clock widget (if in) | Calls `POST /api/attendance/check-out` |
| **Apply for Leave** | `btn-primary btn-sm` | `bi-plus-lg` | Leave balances card | Opens `ApplyLeaveModal` |
| **View Full Attendance**| `btn-link btn-sm` | `bi-arrow-right` | Clock widget footer | Navigates to `/attendance/my` |

---

### Page 16: Employee My Attendance (`/attendance/my`)
- **Role Access**: All authenticated users
- **Purpose**: Personal monthly attendance calendar and detailed daily check-in logs.

#### Visual Layout:
- **Top Section**: Live `AttendanceWidget` (Digital clock + check in/out button).
- **Month Selector**: Month-Year picker with `< Previous Month` and `Next Month >` navigation.
- **Monthly Summary Stat Cards**:
  - Total Days Present, Late Days, Half-Days, Total Hours Worked.
- **Detailed Attendance Table**:
  - Columns: `Date`, `Day`, `Check In`, `Check Out`, `Total Hours`, `Derived Status Badge`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Previous Month** | `btn-outline-secondary btn-sm` | `bi-chevron-left` | Month selector | Loads previous month data |
| **Next Month** | `btn-outline-secondary btn-sm` | `bi-chevron-right`| Month selector | Loads next month data |

---

### Page 17: Employee My Leaves (`/leaves/my`)
- **Role Access**: All authenticated users
- **Purpose**: View leave balances, submit leave applications, and track application status.

#### Visual Layout:
- **PageHeader**:
  - Title: "My Leaves"
  - Subtitle: "Track your annual allocations and apply for time off"
  - Action: **+ Apply for Leave** button.
- **Leave Balance Cards (4 Grid Cards)**:
  - Casual Leave, Sick Leave, Earned Leave, Unpaid Leave.
  - Numbers: `Available`, `Allocated`, `Used`, `Pending Approval`.
- **Application History Table**:
  - Columns: `Leave Type`, `Dates (Start - End)`, `Working Days`, `Reason`, `Applied On`, `Status Badge`, `Actions (Cancel)`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Apply for Leave** | `btn-primary` | `bi-plus-lg` | Top right PageHeader | Opens `ApplyLeaveModal` |
| **Cancel Request** | `btn-outline-danger btn-sm` | `bi-trash` | Table row action | Cancels future pending/approved leave |

#### Modal: `ApplyLeaveModal`
- **Inputs**:
  - Leave Type (`select`: Casual, Sick, Earned, Unpaid)
  - Start Date (`date picker`, min 7-day backdate allowed)
  - End Date (`date picker`)
  - Half Day toggle (`checkbox`)
  - Reason (`textarea`, required, min 5 chars)
- **Live Preview Callout**:
  - Automatically calculates and displays: `Estimated Working Days: 2.0 (Weekends and official holidays excluded)`.
- **Buttons**:
  - **Cancel**: `btn-outline-secondary`
  - **Submit Application**: `btn-primary` (Disables while submitting)

---

### Page 18: Leave & Holiday Calendar (`/leaves/calendar`)
- **Role Access**: All authenticated users
- **Purpose**: Month-by-month visual calendar showing team leaves and official company holidays.

#### Visual Layout:
- **Calendar Controls**: Month and Year dropdowns, Today button.
- **Legend Bar**:
  - `🟢 Approved Leave`, `🟡 Pending Leave`, `⭐ Official Holiday`, `⚪ Weekend`.
- **Calendar Grid (7x5 Grid)**:
  - Days of the week header (Sun, Mon, Tue, Wed, Thu, Fri, Sat).
  - Date cells with indicator chips of who is off and holiday titles.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Previous Month** | `btn-outline-secondary btn-sm` | `bi-chevron-left` | Calendar header | Moves to previous month |
| **Next Month** | `btn-outline-secondary btn-sm` | `bi-chevron-right`| Calendar header | Moves to next month |
| **Today** | `btn-light btn-sm` | `bi-calendar-check`| Calendar header | Jumps to current month |

---

### Page 19: Training & Skill Development Programs (`/trainings`)
- **Role Access**: HR (`hr`), Manager (`manager`), Employee (`employee`)
- **Purpose**: Course catalog, skill development programs, employee enrollment, and completion scoring.

#### Visual Layout:
- **For HR & Managers**:
  - PageHeader Action: **+ Create Training Program**.
  - Program Cards Grid (Online / In-Person, Title, Department, Capacity Meter, Start/End Dates, Status).
- **For Employees**:
  - Tab 1: *My Enrolled Courses* (With progress bar %, syllabus, feedback submission).
  - Tab 2: *Available Catalog* (Browse open programs).

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Create Training Program**| `btn-primary` | `bi-plus-lg` | Top right PageHeader | Opens `CreateProgramModal` (Manager/HR) |
| **View Details** | `btn-outline-primary btn-sm` | `bi-eye` | Program card | Navigates to `/trainings/:id` |
| **Enroll Direct Reports** | `btn-success btn-sm` | `bi-person-plus` | Program card (Manager)| Opens `EnrollEmployeesModal` |
| **Update My Progress** | `btn-outline-secondary btn-sm` | `bi-sliders` | Enrolled card (Employee)| Opens `UpdateProgressModal` |

#### Modal 1: `CreateProgramModal`
- **Inputs**:
  - Program Title (`text`, required)
  - Department (`select`)
  - Description & Learning Objectives (`textarea`)
  - Delivery Type (`select`: `online`, `in-person`)
  - Maximum Capacity (`number`, e.g. `20`)
  - Start Date & End Date (`date pickers`)
- **Buttons**:
  - **Cancel**: `btn-outline-secondary`
  - **Create Program**: `btn-primary`

#### Modal 2: `EnrollEmployeesModal`
- **Inputs**:
  - Multi-select checkbox list of direct reports eligible for enrollment.
  - Remaining capacity indicator badge.
- **Buttons**:
  - **Cancel**: `btn-outline-secondary`
  - **Confirm Enrollment**: `btn-success`

---

### Page 20: Training Detail & Roster (`/trainings/:id`)
- **Role Access**: All roles (Scoped actions for Manager / HR)
- **Purpose**: Program syllabus, enrolled roster, score recording, and completion certificates.

#### Visual Layout:
- **Program Overview Card**:
  - Title, Delivery type badge, Capacity bar (`e.g. 14 / 20 Enrolled`), Dates, Creator.
  - Manager CTA: **Enroll Employees**.
- **Enrolled Roster Table**:
  - Columns: `Employee (Avatar + Name)`, `Progress % (Progress bar)`, `Status Badge (Enrolled, In Progress, Completed)`, `Score / Grade`, `Feedback / Notes`, `Actions`.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Enroll Employees** | `btn-primary btn-sm` | `bi-person-plus` | Header action | Opens `EnrollEmployeesModal` |
| **Record Score** | `btn-outline-primary btn-sm` | `bi-award` | Roster row action | Opens `ScoreModal` (Manager only) |
| **Drop Enrollment** | `btn-outline-danger btn-sm` | `bi-trash` | Roster row action | Opens `ConfirmModal` |

---

### Page 21: Announcements Bulletin Feed (`/announcements`)
- **Role Access**: All authenticated users
- **Purpose**: Read organizational news, HR policies, and urgent announcements.

#### Visual Layout:
- Priority Alert Banners (Pinned announcements with yellow/orange borders).
- Announcement Cards:
  - Header: Author Name, Role, Audience Badge (`ALL`, `DEPARTMENT`), Timestamp.
  - Title: Bold `18px`.
  - Content: Formatted text with sanitization.
  - Priority Badge: `Urgent` (Red), `Normal` (Blue).

---

### Page 22: Company Directory (`/directory`)
- **Role Access**: All authenticated users
- **Purpose**: Public staff directory to search colleagues, see designations, departments, and work emails.

#### Visual Layout:
- **Search & Filter Bar**:
  - Search input (`Filter by name, email, designation...`).
  - Department filter pill dropdown.
- **Staff Card Grid**:
  - Clean card with circular avatar, user initials, full name, designation, department pill, mail link (`mailto:`).

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Email Colleague** | `btn-outline-secondary btn-sm` | `bi-envelope` | Card action | Opens default email client (`mailto:`) |

---

### Page 23: My Profile & Self Service (`/profile`)
- **Role Access**: All authenticated users
- **Purpose**: View employee employment record and update permitted contact details (phone, emergency contact, address).

#### Visual Layout:
- **Header Profile Card**:
  - Large avatar circle with user initials, full name, designation, department, employee code (`EMP-xxxx`).
- **Two Columns**:
  - Left Column (Read-Only Employment Info): Date of joining, Reporting manager, Role, Work email.
  - Right Column (Editable Contact Details):
    - Phone Number input
    - Emergency Contact Name & Phone
    - Residential Address textarea
    - Action: **Save Contact Details**.

#### Buttons & Controls:
| Button Label | Visual Style | Icon | Location / Context | Action / Trigger |
|---|---|---|---|---|
| **Save Contact Details**| `btn-primary` | `bi-check2` | Profile form bottom | Submits `PUT /api/employees/me` |
| **Change Password** | `btn-outline-secondary` | `bi-key` | Profile header | Navigates to `/change-password` |

---

### Page 24: 403 Forbidden Access Denied (`/forbidden`)
- **Role Access**: Any user navigating to unauthorized routes
- **Visual**: Centered shield lock illustration (`#d97706`), bold heading "403 — Access Denied", message "You do not have permission to access this page. This area is restricted based on your account role."
- **Button**:
  - **Return to Dashboard**: `btn-primary`, icon `bi-arrow-left`, navigates back to root dashboard.

---

### Page 25: 404 Not Found (`*`)
- **Role Access**: Public / All
- **Visual**: Centered magnifying glass illustration, bold heading "404 — Page Not Found", message "The page you are looking for does not exist or has been moved."
- **Button**:
  - **Back to Safety**: `btn-primary`, icon `bi-house-door`, navigates back to `/`.

---

## 🧩 4. Reusable Component Catalog for Stitch

When building your component library in Stitch, create these master components:

1. **`Button` Component**:
   - Variants: `Primary` (`#4F46E5`), `Secondary / Light`, `Outline`, `Success` (`#16A34A`), `Danger` (`#DC2626`), `Warning` (`#D97706`).
   - Sizes: `Small (32px height)`, `Medium (38px height)`, `Large (44px height)`.
   - States: `Default`, `Hover`, `Focused`, `Disabled`, `Loading (with spinner)`.

2. **`StatusBadge` Component**:
   - Variants:
     - `Active` / `Approved` / `Present`: Green subtle (`#DCFCE7` bg, `#16A34A` text).
     - `Pending` / `Late` / `Holiday`: Amber subtle (`#FEF3C7` bg, `#D97706` text).
     - `Rejected` / `Absent` / `Deactivated`: Red subtle (`#FEE2E2` bg, `#DC2626` text).
     - `Half-Day` / `Manager`: Blue subtle (`#E0F2FE` bg, `#0284C7` text).
     - `HR`: Purple subtle (`#F3E8FF` bg, `#7E22CE` text).
     - `Employee`: Gray subtle (`#F3F4F6` bg, `#4B5563` text).

3. **`StatCard` Component**:
   - Inputs: Title, Value (tabular numbers), Subtitle/Comparison, Icon (in colored circle wrapper), Trend indicator.

4. **`DataTable` Component**:
   - Header with sort arrows (`bi-arrow-down-up`), hoverable rows, rounded card wrapper, border dividers, empty state graphic, pagination controls.

5. **`ModalDialog` Component**:
   - Header with title & close button (`bi-x-lg`), scrollable content body, border-top footer with `Cancel` (left) and `Primary Action` (right).

---

## 📐 5. Responsive Grid & Breakpoint Guidelines

- **Desktop (>= 1200px)**:
  - Sidebar visible (`260px` fixed).
  - Main container padding `32px`.
  - 4-column metric grids (`grid-template-columns: repeat(4, 1fr)`).
- **Tablet (768px - 1199px)**:
  - Sidebar collapses into offcanvas drawer.
  - Hamburger menu icon appears on topbar.
  - 2-column metric grids (`grid-template-columns: repeat(2, 1fr)`).
- **Mobile (< 768px)**:
  - Offcanvas drawer for navigation.
  - Single column stacking for stat cards, tables allow horizontal scroll.
  - Full width modal buttons.
