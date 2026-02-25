<?php
// AJAX page loader for loading WordPress page content dynamically
// This file is called by the frontend JavaScript to load page content without full page refresh

// Load WordPress
define("WP_USE_THEMES", false);
require "/var/www/volatile/wpabi/wp-load.php";

// Get the page ID from POST request
$page_id = isset($_POST['page_id']) ? intval($_POST['page_id']) : 0;

if ($page_id > 0) {
    // Get the page object
    $page = get_post($page_id);

    if ($page && $page->post_type === 'page') {
        // Output the page content
        echo apply_filters('the_content', $page->post_content);
    } else {
        echo '<p>Page not found.</p>';
    }
} else {
    echo '<p>Invalid page ID.</p>';
}
