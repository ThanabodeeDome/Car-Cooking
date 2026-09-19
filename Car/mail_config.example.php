<?php
// Copy to mail_config.php and fill in. mail_config.php is git-ignored (holds a password).
// Free options: Gmail (2-step verification on -> create an "App password"), Outlook.com, or the company SMTP server.
return [
    'enabled'      => false,                 // set true once SMTP below is filled in
    'host'         => 'smtp.gmail.com',
    'port'         => 587,
    'secure'       => 'tls',                 // 'tls' (587) | 'ssl' (465) | '' (none)
    'username'     => 'your-account@gmail.com',
    'password'     => 'app-password-here',
    'from_email'   => 'your-account@gmail.com',
    'from_name'    => 'ระบบจองรถ',
    'base_url'     => 'http://your-server/Car',   // used for links inside emails
    'admin_emails' => [],                    // e.g. ['fleet@company.com'] – get overdue/problem digests
];
