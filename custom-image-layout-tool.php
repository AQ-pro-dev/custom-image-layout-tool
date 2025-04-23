<?php
/*
Plugin Name: Custom Image Layout Tool
Description: A WordPress plugin to provide a custom image layout tool with canvas functionality.
Version: 1.0
Author: The Pro Developer.
*/

// Enqueue styles and scripts
function custom_image_layout_enqueue_scripts() {
    wp_enqueue_style('jquery-ui-css', 'https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css');
    wp_enqueue_style('custom-layout-style', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
    wp_enqueue_style('font-awesome-style', plugin_dir_url(__FILE__) . 'assets/css/style.css');    
    wp_enqueue_script('jquery', 'https://code.jquery.com/jquery-3.7.1.min.js', array(), null, true);
    wp_enqueue_script('custom-layout-config', plugin_dir_url(__FILE__) . 'assets/js/config.js', array('jquery'), null, true);
    wp_enqueue_script('custom-layout-canvas', plugin_dir_url(__FILE__) . 'assets/js/canvas.js', array('jquery'), null, true);
}
add_action('wp_enqueue_scripts', 'custom_image_layout_enqueue_scripts');

// Shortcode to render the layout tool
function custom_image_layout_shortcode() {
    ob_start();
    ?>
    <div class="header">
        <select class="sheet-selector" id="sheetSize">
            <option value="dtf">DTF Sheet (51x31 cm)</option>
            <option value="screen">Screen Printing Sheet (48x31 cm)</option>
            <option value="dye">Dye-Block Sheet (46x31 cm)</option>
        </select>
        <div class="company-logo"><a href="<?php echo home_url('/');?>"><img src="<?php echo plugin_dir_url(__FILE__) . 'assets/images/logo.PNG'; ?>" alt="Company Logo"></a></div>
    </div>

    <div class="toolbar">
        <input type="file" id="imageUpload" accept="image/*" multiple style="display: none">
        <button id="uploadBtn" title="Upload Images">
            <i class="fas fa-upload"></i> Upload
        </button>
        <button id="duplicateBtn" title="Duplicate">
            <i class="fas fa-copy"></i> Duplicate
        </button>
        <button id="magneticFitBtn" title="Magnetic Fit Mode">
            <i class="fas fa-magnet"></i> Magnetic Fit
        </button>
        <button id="rotateBtn" title="Rotate 90°">
            <i class="fas fa-redo"></i> Rotate 90°
        </button>
        
        
        <button id="width9cm" title="Set 9cm Width">9cm Width</button>
        <button id="width28cm" title="Set 28cm Width">28cm Width</button>
        
        <!-- My code -->
        <div class="resize-slider-wrapper">
            <label for="resizeSlider">Resize:</label>
            <input type="range" id="resizeSlider" min="10" max="300" step="5" value="100">
            <span id="resizeSliderValue">100%</span>
        </div>
        <button id="resetSizeBtn" title="Reset Size">
            <i class="fas fa-undo"></i>
        </button>
		<div class="size-display">
            Selected Logo Size: <span id="imageSizeCm">0 x 0 cm</span>
        </div>
        <!-- end -->
		<!-- Spacer to push export button to the right -->
		<div class="spacer"></div>

		<!-- Export button stays the same -->
		<div class="export-buttons dropdown-wrapper">
			<button class="dropdown-toggle">
				<i class="fas fa-file-export"></i> Export
			</button>
			<ul class="dropdown-menu">
				<li><a href="#" id="exportJpg"> Export as JPG</a></li>
				<li><a href="#" id="exportPng"> Export as PNG</a></li>
			</ul>
		</div>
	</div>

    <div class="main-container">
        <div class="preview-panel">
            <h3>Uploaded Images</h3>
            <div id="previewImages"></div>
        </div>
        
        <div class="canvas-container">
            <canvas id="mainCanvas"></canvas>
            <div class="grid-overlay" id="gridOverlay"></div>
        </div>

    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('custom_image_layout', 'custom_image_layout_shortcode');