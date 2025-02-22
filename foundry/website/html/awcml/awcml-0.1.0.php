<?php

  function ___debug($msg) {
    $timestamp = date("H:i:s");
    $file = __FILE__;
    $line = __LINE__;
    $indented = preg_replace("/^.*$/m", ">>> $0", $msg);
    file_put_contents(
        "php://stderr",
        "[$timestamp][andrewcheong.com][PHP][$file:$line]\n$indented\n"
    );
  }

  function ___debug_r($msg) {
    ___debug(print_r($msg, true));
  }

  // TODO: Look in awcml-themes for default.* or the first one.
  $latest_theme = "first";

  // PHP 7.0+ method for defaulting if not set.
  $theme = $_GET["theme"] ?? $latest_theme;
  $page = $_GET["page"] ?? "index";

  ___debug("theme=<$theme>, page=<$page>");

  // TODO: Allow any extension. Maybe fail rather than choose if multiple.
  $theme_file = "awcml-themes/theme.$theme.html";
  if (!file_exists($theme_file)) {
    ___debug("failed to find $theme_file");
    http_response_code(404);
    die();
  }

  $page_file = "$page.awcml";
  if (!file_exists($page_file)) {
    ___debug("failed to find $page_file");
    http_response_code(404);
    die();
  }

  $core_file = "awcml/awcml.awcml";
  if (!file_exists($core_file)) {
    ___debug("failed to find $core_file");
    http_response_code(404);
    die();
  }

  define("AWCML_CORE", file_get_contents($core_file));

  define("AWCML_PAGE_CONTENT", file_get_contents($page_file));

  require($theme_file);
?>
