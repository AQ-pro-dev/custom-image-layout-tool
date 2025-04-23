let canvas, ctx;
let images = [];
let selectedImages = new Set();
let isDragging = false;
let isResizing = false;
let currentHandle = null;
let startX, startY;
let snapToGrid = false;
let currentSheetSize = CONFIG.SHEET_SIZES.dtf;
let ctrlPressed = false;
let showMagneticRedBox = false;

class ImageObject {
    constructor(src, x, y, width, height, isDuplicate = false) {
        this.src = src;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rotation = 0;
        this.img = new Image();
        this.img.src = src;
        this.aspectRatio = 1;
        this.selected = false;
    
        this.originalWidth = width;
        this.originalHeight = height;
    
        this.img.onload = () => {
            this.aspectRatio = this.img.width / this.img.height;
    
            // ✅ Only set default size IF NOT duplicate
            if (!isDuplicate) {
                this.setWidthInCm(9);
                this.originalWidth = this.width;
                this.originalHeight = this.height;
            } else {
                // ✅ Keep duplicated image size as-is
                this.width = width;
                this.height = height;
                this.originalWidth = width;
                this.originalHeight = height;
            }
    
            draw();
        };
    }
    

    getWidthInCm() {
        return this.width / CONFIG.CANVAS_SCALE;
    }

    getHeightInCm() {
        return this.height / CONFIG.CANVAS_SCALE;
    }

    setWidthInCm(width) {
        this.width = width * CONFIG.CANVAS_SCALE;
        this.height = (width / this.aspectRatio) * CONFIG.CANVAS_SCALE;
    }

    setHeightInCm(height) {
        this.height = height * CONFIG.CANVAS_SCALE;
        this.width = height * this.aspectRatio * CONFIG.CANVAS_SCALE;
    }

    setCustomSize(width, height) {
        this.width = width * CONFIG.CANVAS_SCALE;
        this.height = height * CONFIG.CANVAS_SCALE;
    }
    
    moveBy(dx, dy) {
        const newX = this.x + dx;
        const newY = this.y + dy;
    
        // Set new position first
        this.x = newX;
        this.y = newY;
    
        // Calculate bounding box based on rotation
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
    
        const halfW = this.width / 2;
        const halfH = this.height / 2;
    
        const corners = [
            { x: -halfW, y: -halfH },
            { x: halfW, y: -halfH },
            { x: halfW, y: halfH },
            { x: -halfW, y: halfH }
        ].map(p => ({
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        }));
    
        const centerX = this.x + halfW;
        const centerY = this.y + halfH;
    
        const minX = Math.min(...corners.map(p => centerX + p.x));
        const maxX = Math.max(...corners.map(p => centerX + p.x));
        const minY = Math.min(...corners.map(p => centerY + p.y));
        const maxY = Math.max(...corners.map(p => centerY + p.y));
    
        const margin = CONFIG.MARGIN * CONFIG.CANVAS_SCALE;
        const safePadding = CONFIG.MARGIN * CONFIG.CANVAS_SCALE; // <- another 0.5cm safe distance from edges
    
        const safeMin = margin + safePadding;
        const safeMaxX = canvas.width - safeMin;
        const safeMaxY = canvas.height - safeMin;
    
        // Compute how much it crosses the "safe boundary"
        const deltaX = Math.max(safeMin - minX, 0) + Math.min(safeMaxX - maxX, 0);
        const deltaY = Math.max(safeMin - minY, 0) + Math.min(safeMaxY - maxY, 0);
    
        this.x += deltaX;
        this.y += deltaY;
    }   
    
    clampInsideCanvas() {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
    
        const halfW = this.width / 2;
        const halfH = this.height / 2;
    
        const corners = [
            { x: -halfW, y: -halfH },
            { x: halfW, y: -halfH },
            { x: halfW, y: halfH },
            { x: -halfW, y: halfH }
        ].map(p => ({
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        }));
    
        const centerX = this.x + halfW;
        const centerY = this.y + halfH;
    
        const minX = Math.min(...corners.map(p => centerX + p.x));
        const maxX = Math.max(...corners.map(p => centerX + p.x));
        const minY = Math.min(...corners.map(p => centerY + p.y));
        const maxY = Math.max(...corners.map(p => centerY + p.y));
    
        const margin = CONFIG.MARGIN * CONFIG.CANVAS_SCALE;
        const imageSafePadding = CONFIG.MARGIN * CONFIG.CANVAS_SCALE; // additional padding from margin
        const totalSafe = margin + imageSafePadding;
    
        const allowedMinX = totalSafe;
        const allowedMaxX = canvas.width - totalSafe;
        const allowedMinY = totalSafe;
        const allowedMaxY = canvas.height - totalSafe;
    
        let shiftX = 0;
        let shiftY = 0;
    
        if (minX < allowedMinX) shiftX = allowedMinX - minX;
        else if (maxX > allowedMaxX) shiftX = allowedMaxX - maxX;
    
        if (minY < allowedMinY) shiftY = allowedMinY - minY;
        else if (maxY > allowedMaxY) shiftY = allowedMaxY - maxY;
    
        this.x += shiftX;
        this.y += shiftY;
    }
     

    draw(ctx, cleanExport = false) {
        ctx.save();
    
        // Move to image center and rotate
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation * Math.PI / 180);
    
        // Draw image
        ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
    
        // Draw selection box and handles (after rotation)
        if (this.selected && !cleanExport) {
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.strokeRect(-this.width / 2 - 1, -this.height / 2 - 1, this.width + 2, this.height + 2);
            this.drawResizeHandles(ctx, true); // pass rotated context
        }
        if (!cleanExport && showMagneticRedBox) {
            const padding = CONFIG.MARGIN * CONFIG.CANVAS_SCALE; // 0.5cm = 5mm
        
            // Align red box with the rotated image
            ctx.beginPath();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
        
            // The box is centered around origin because of ctx.translate earlier
            ctx.strokeRect(
                -this.width / 2 - padding,
                -this.height / 2 - padding,
                this.width + 2 * padding,
                this.height + 2 * padding
            );
        }
    
        ctx.restore();
    }   

    containsPoint(x, y) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const theta = -this.rotation * Math.PI / 180;
        const rx = dx * Math.cos(theta) - dy * Math.sin(theta);
        const ry = dx * Math.sin(theta) + dy * Math.cos(theta);
        
        return Math.abs(rx) <= this.width / 2 && Math.abs(ry) <= this.height / 2;
    }    

    drawResizeHandles(ctx, isRotated = false) {
        const handlePositions = [
            { x: -this.width / 2, y: -this.height / 2 }, // top-left
            { x: this.width / 2, y: -this.height / 2 },  // top-right
            { x: -this.width / 2, y: this.height / 2 },  // bottom-left
            { x: this.width / 2, y: this.height / 2 },   // bottom-right
            { x: -this.width / 2, y: 0 },                // left
            { x: this.width / 2, y: 0 }                  // right
        ];
    
        handlePositions.forEach(pos => {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
        });
    }
    
}

function initCanvas() {
    canvas = document.getElementById('mainCanvas');
    ctx = canvas.getContext('2d');
    updateCanvasSize();
    setupEventListeners();
    draw();
}

function updateCanvasSize() {
    canvas.width = currentSheetSize.width * CONFIG.CANVAS_SCALE;
    canvas.height = currentSheetSize.height * CONFIG.CANVAS_SCALE;
    
    const container = document.querySelector('.canvas-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const scaleX = containerWidth / canvas.width;
    const scaleY = containerHeight / canvas.height;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
}

function setupEventListeners() {
    // mycode
    jQuery('#resizeSlider').on('input', function () {
        const scalePercent = parseInt(this.value);
        jQuery('#resizeSliderValue').text(scalePercent + '%');
        scaleSelectedImages(scalePercent);
    });
    jQuery('#magneticFitBtn').on('click', () => {
        applyMagneticFit();
    });
    jQuery('#resetSizeBtn').on('click', () => {
        images.filter(img => img.selected).forEach(img => {
            // Reset size
            const centerX = img.x + img.width / 2;
            const centerY = img.y + img.height / 2;
    
            img.width = img.originalWidth;
            img.height = img.originalHeight;
    
            // Re-center image
            img.x = centerX - img.width / 2;
            img.y = centerY - img.height / 2;
        });
    
        jQuery('#resizeSlider').val(100);
        jQuery('#resizeSliderValue').text('100%');
        draw();
        updateSizeDisplay();
    });
    // Toggle export dropdown menu
    jQuery('.dropdown-toggle').on('click', function (e) {
        e.stopPropagation();
        jQuery('.dropdown-menu').toggle();
    });

    // Hide menu on outside click
    jQuery(document).on('click', function () {
        jQuery('.dropdown-menu').hide();
    });

    const dropZones = [
        document.getElementById('uploadBtn'),
        document.getElementById('mainCanvas'),
        document.getElementById('previewImages')
    ];

    dropZones.forEach(zone => {
        if (zone) {
            zone.addEventListener('dragover', handleDragOver);
            zone.addEventListener('drop', handleDrop);
        }
    });

    //end

    jQuery('#sheetSize').on('change', function() {
        currentSheetSize = CONFIG.SHEET_SIZES[this.value];
        updateCanvasSize();
        draw();
    });

    jQuery('#uploadBtn').on('click', () => jQuery('#imageUpload').click());
    jQuery('#imageUpload').on('change', handleImageUpload);

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseup', handleMouseUp);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    jQuery('#duplicateBtn').on('click', duplicateSelected);
    jQuery('#rotateBtn').on('click', rotateSelected);
    jQuery('#snapGridBtn').on('click', toggleGrid);
    jQuery('#width9cm').on('click', () => setSelectedWidth(9));
    jQuery('#width28cm').on('click', () => setSelectedWidth(28));
    jQuery('#applySize').on('click', applyCustomSize);
    jQuery('#exportJpg').on('click', () => exportCanvas('jpg'));
    jQuery('#exportPng').on('click', () => exportCanvas('png'));

    jQuery(document).on('click', '.move-up', function(e) {
        e.stopPropagation();
        const index = jQuery(this).closest('.preview-image-container').data('index');
        if (index > 0) {
            [images[index], images[index - 1]] = [images[index - 1], images[index]];
            updatePreviewPanel();
            draw();
        }
    });

    jQuery(document).on('click', '.move-down', function(e) {
        e.stopPropagation();
        const index = jQuery(this).closest('.preview-image-container').data('index');
        if (index < images.length - 1) {
            [images[index], images[index + 1]] = [images[index + 1], images[index]];
            updatePreviewPanel();
            draw();
        }
    });

    jQuery(document).on('click', '.delete', function(e) {
        e.stopPropagation();
        const index = jQuery(this).closest('.preview-image-container').data('index');
        images.splice(index, 1);
        updatePreviewPanel();
        draw();
    });

    window.addEventListener('resize', () => {
        updateCanvasSize();
        draw();
    });
}
//my code
function applyMagneticFit() {
    if (images.length === 0) return;

    showMagneticRedBox = true;

    const gap = CONFIG.MARGIN * 2 * CONFIG.CANVAS_SCALE; // 1.0 cm between logos
    const internalCanvasMargin = CONFIG.MARGIN * CONFIG.CANVAS_SCALE;
    const padding = internalCanvasMargin + CONFIG.MARGIN * CONFIG.CANVAS_SCALE;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // ✅ Sort images by visible area (smallest first)
    const sortedImages = [...images].sort((a, b) => (a.width * a.height) - (b.width * b.height));
    const placed = new Set();

    let currentY = padding;

    while (placed.size < sortedImages.length) {
        let currentX = padding;
        let rowMaxHeight = 0;
        let anyPlacedInRow = false;

        for (let i = 0; i < sortedImages.length; i++) {
            const img = sortedImages[i];
            if (placed.has(img)) continue;

            // Compute bounding box considering rotation
            const rad = img.rotation * Math.PI / 180;
            const sin = Math.abs(Math.sin(rad));
            const cos = Math.abs(Math.cos(rad));
            const rotatedWidth = img.width * cos + img.height * sin;
            const rotatedHeight = img.width * sin + img.height * cos;

            if (currentX + rotatedWidth <= canvasWidth - padding && currentY + rotatedHeight <= canvasHeight - padding) {
                // Place image
                img.x = currentX + (rotatedWidth - img.width) / 2;
                img.y = currentY + (rotatedHeight - img.height) / 2;

                currentX += rotatedWidth + gap;
                rowMaxHeight = Math.max(rowMaxHeight, rotatedHeight);
                placed.add(img);
                anyPlacedInRow = true;
            }
        }

        if (!anyPlacedInRow) {
            alert(`Only ${placed.size} images fit on canvas with current sizes and spacing.`);
            break;
        }

        currentY += rowMaxHeight + gap;
    }

    draw();
}


// function applyMagneticFit() {
//     if (images.length === 0) return;

//     showMagneticRedBox = true;

//     const gap = CONFIG.MARGIN * 2 * CONFIG.CANVAS_SCALE; // 1.0 cm between logos
//     const internalCanvasMargin = CONFIG.MARGIN * CONFIG.CANVAS_SCALE;
//     const padding = internalCanvasMargin + CONFIG.MARGIN * CONFIG.CANVAS_SCALE;

//     const canvasWidth = canvas.width;
//     const canvasHeight = canvas.height;

//     // ✅ Sort images by visible area (smallest first)
//     const sortedImages = [...images].sort((a, b) => (a.width * a.height) - (b.width * b.height));

//     let currentX = padding;
//     let currentY = padding;
//     let rowMaxHeight = 0;

//     const placed = new Set();

//     while (placed.size < sortedImages.length) {
//         let imagePlacedInRow = false;

//         for (let i = 0; i < sortedImages.length; i++) {
//             const img = sortedImages[i];
//             if (placed.has(img)) continue;

//             // Calculate rotated bounding box
//             const rad = img.rotation * Math.PI / 180;
//             const sin = Math.abs(Math.sin(rad));
//             const cos = Math.abs(Math.cos(rad));
//             const rotatedWidth = img.width * cos + img.height * sin;
//             const rotatedHeight = img.width * sin + img.height * cos;

//             if (currentX + rotatedWidth <= canvasWidth - padding && currentY + rotatedHeight <= canvasHeight - padding) {
//                 // Place image
//                 img.x = currentX + (rotatedWidth - img.width) / 2;
//                 img.y = currentY + (rotatedHeight - img.height) / 2;

//                 currentX += rotatedWidth + gap;
//                 rowMaxHeight = Math.max(rowMaxHeight, rotatedHeight);
//                 placed.add(img);
//                 imagePlacedInRow = true;
//             }
//         }

//         if (!imagePlacedInRow) {
//             // No more image fits in this row, go to next row
//             currentX = padding;
//             currentY += rowMaxHeight + gap;
//             rowMaxHeight = 0;

//             if (currentY > canvasHeight - padding) {
//                 alert(`Only ${placed.size} images fit on canvas with current sizes and spacing.`);
//                 break;
//             }
//         }
//     }

//     draw();
// }


function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    handleDroppedFiles(files);
}

function handleDroppedFiles(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const SAFE_PADDING = CONFIG.MARGIN * CONFIG.CANVAS_SCALE;
            const totalPadding = CONFIG.MARGIN * CONFIG.CANVAS_SCALE + SAFE_PADDING;
            
            const img = new ImageObject(
                event.target.result,
                totalPadding,
                totalPadding,
                9 * CONFIG.CANVAS_SCALE,
                9 * CONFIG.CANVAS_SCALE
            );
            img.clampInsideCanvas(); // still keep this for safet
            images.push(img);
			showMagneticRedBox = true;
            updatePreviewPanel();
            draw();
        };
        reader.readAsDataURL(file);
    });
}

function updateSizeDisplay() {
    const selectedImages = images.filter(img => img.selected);

    if (selectedImages.length === 1) {
        const img = selectedImages[0];
        const widthCm = (img.width / CONFIG.CANVAS_SCALE).toFixed(1);
        const heightCm = (img.height / CONFIG.CANVAS_SCALE).toFixed(1);
        jQuery('#imageSizeCm').text(`${widthCm} x ${heightCm} cm`);
    } else if (selectedImages.length > 1) {
        jQuery('#imageSizeCm').text(`Multiple selected`);
    } else {
        jQuery('#imageSizeCm').text(`0 x 0 cm`);
    }
}

function updateResizeSlider() {
    const selected = images.find(img => img.selected);
    if (selected) {
        const percent = Math.round((selected.width / selected.originalWidth) * 100);
        jQuery('#resizeSlider').val(percent);
        jQuery('#resizeSliderValue').text(`${percent}%`);
    }
}

function scaleSelectedImages(percent) {
    const scaleFactor = percent / 100;
    const minSizePx = CONFIG.MIN_IMAGE_SIZE * CONFIG.CANVAS_SCALE;

    images.filter(img => img.selected).forEach(img => {
        // Always resize from original size
        let newWidth = img.originalWidth * scaleFactor;
        let newHeight = img.originalHeight * scaleFactor;

        // Prevent too-small image
        if (newWidth < minSizePx) {
            newWidth = minSizePx;
            newHeight = newWidth / img.aspectRatio;
        }

        // Adjust X/Y to keep image centered
        const centerX = img.x + img.width / 2;
        const centerY = img.y + img.height / 2;

        img.width = newWidth;
        img.height = newHeight;
        img.x = centerX - newWidth / 2;
        img.y = centerY - newHeight / 2;
        img.clampInsideCanvas();
    });

    draw();
    updateSizeDisplay();
}
//end

function handleImageUpload(e) {
    const files = e.target.files;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const SAFE_PADDING = CONFIG.MARGIN * CONFIG.CANVAS_SCALE;
            const totalPadding = CONFIG.MARGIN * CONFIG.CANVAS_SCALE + SAFE_PADDING;

            const img = new ImageObject(
                event.target.result,
                totalPadding,
                totalPadding,
                9 * CONFIG.CANVAS_SCALE,
                9 * CONFIG.CANVAS_SCALE
            );
            img.clampInsideCanvas(); // still keep this for safet
            images.push(img);
			showMagneticRedBox = true;
            updatePreviewPanel();
            draw();
        };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
}

function updatePreviewPanel() {
    const container = jQuery('#previewImages');
    container.empty();
    
    images.forEach((img, index) => {
        const preview = jQuery(`
            <div class="preview-image-container ${img.selected ? 'selected' : ''}" data-index="${index}">
                <img src="${img.src}" class="preview-image">
                <div class="preview-controls">
                    <button class="move-up" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                    <!--<button class="move-down" title="Move Down"><i class="fas fa-arrow-down"></i></button>-->
                    <button class="delete" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);
        
        preview.on('click', function() {
            if (!ctrlPressed) {
                images.forEach(img => img.selected = false);
            }
            images[index].selected = !images[index].selected;
            jQuery(this).toggleClass('selected');
            draw();
            updateSizeDisplay();
        });
        
        container.append(preview);
    });
}

document.addEventListener("DOMContentLoaded", function() {
    let canvas = document.getElementById("mainCanvas");
    if (canvas) {
        canvas.addEventListener("mousedown", handleMouseDown);
    } else {
        console.error("Canvas element not found!");
    }
});

function handleMouseDown(e) {
    if (!e) return; // Prevents the error if no event is passed

    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    startX = (e.clientX - rect.left) * scale;
    startY = (e.clientY - rect.top) * scale;

    if (handleResizeHandleClick(startX, startY)) {
        return;
    }

    let clickedImage = null;
    for (let i = images.length - 1; i >= 0; i--) {
        if (images[i].containsPoint(startX, startY)) {
            clickedImage = images[i];
            break;
        }
    }

    if (clickedImage) {
        if (!ctrlPressed) {
            images.forEach(img => img.selected = false);
        }
        clickedImage.selected = !clickedImage.selected;
        isDragging = true;
//         showMagneticRedBox = false; client requirment the red box should be all time show
        updatePreviewPanel();
    } else if (!ctrlPressed) {
        images.forEach(img => img.selected = false);
        updatePreviewPanel();
    }

    draw();
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scale;
    const mouseY = (e.clientY - rect.top) * scale;

    // ✅ Always check for resize handle hover to show cursor icon
    const selectedImage = images.find(img => img.selected);
    if (selectedImage && !isDragging && !isResizing) {
        const handles = [
            { x: selectedImage.x, y: selectedImage.y, cursor: 'nw-resize' },
            { x: selectedImage.x + selectedImage.width, y: selectedImage.y, cursor: 'ne-resize' },
            { x: selectedImage.x, y: selectedImage.y + selectedImage.height, cursor: 'sw-resize' },
            { x: selectedImage.x + selectedImage.width, y: selectedImage.y + selectedImage.height, cursor: 'se-resize' },
            { x: selectedImage.x, y: selectedImage.y + selectedImage.height / 2, cursor: 'w-resize' },
            { x: selectedImage.x + selectedImage.width, y: selectedImage.y + selectedImage.height / 2, cursor: 'e-resize' }
        ];

        let cursorSet = false;
        for (const handle of handles) {
            const dx = mouseX - handle.x;
            const dy = mouseY - handle.y;
            if (dx * dx + dy * dy < 64) { // 8px radius
                canvas.style.cursor = handle.cursor;
                cursorSet = true;
                break;
            }
        }

        if (!cursorSet) {
            canvas.style.cursor = 'default';
        }
    }

    // ✅ Continue drag/resize logic
    if (!isDragging && !isResizing) return;

    if (isDragging) {
        const dx = mouseX - startX;
        const dy = mouseY - startY;

        images.filter(img => img.selected).forEach(img => {
            img.moveBy(dx, dy);
        });

        startX = mouseX;
        startY = mouseY;
        draw();
    } else if (isResizing) {
        handleResize(mouseX - startX, mouseY - startY);
        startX = mouseX;
        startY = mouseY;
        draw();
    }
}


function handleMouseUp() {
    isDragging = false;
    isResizing = false;
    currentHandle = null;
    canvas.style.cursor = 'default';
    updateSizeDisplay();
}

function handleKeyDown(e) {
    if (e.key === 'Control') {
        ctrlPressed = true;
    }

    if (e.key === 'Delete') {
        removeSelected();
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        //const moveAmount = snapToGrid ? CONFIG.GRID_SIZE * CONFIG.CANVAS_SCALE : 1;
        const moveAmount = CONFIG.GRID_SIZE * CONFIG.CANVAS_SCALE;
        const dx = (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0) * moveAmount;
        const dy = (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0) * moveAmount;

        images.filter(img => img.selected).forEach(img => {
            img.moveBy(dx, dy);
        });
        draw();
    }
}

function handleKeyUp(e) {
    if (e.key === 'Control') {
        ctrlPressed = false;
    }
}

function handleResizeHandleClick(mouseX, mouseY) {
    const selectedImage = images.find(img => img.selected);
    if (!selectedImage) return false;

    const cx = selectedImage.x + selectedImage.width / 2;
    const cy = selectedImage.y + selectedImage.height / 2;
    const rad = selectedImage.rotation * Math.PI / 180;
    const deg = selectedImage.rotation % 360;

    const handlePositions = [
        { x: -selectedImage.width / 2, y: -selectedImage.height / 2, type: 'nw' },
        { x: selectedImage.width / 2, y: -selectedImage.height / 2, type: 'ne' },
        { x: -selectedImage.width / 2, y: selectedImage.height / 2, type: 'sw' },
        { x: selectedImage.width / 2, y: selectedImage.height / 2, type: 'se' },
        { x: -selectedImage.width / 2, y: 0, type: 'w' },
        { x: selectedImage.width / 2, y: 0, type: 'e' }
    ];

    for (const handle of handlePositions) {
        const rotatedX = cx + handle.x * Math.cos(rad) - handle.y * Math.sin(rad);
        const rotatedY = cy + handle.x * Math.sin(rad) + handle.y * Math.cos(rad);

        const dx = mouseX - rotatedX;
        const dy = mouseY - rotatedY;

        if (dx * dx + dy * dy < 64) {
            isResizing = true;
            currentHandle = handle.type;
            canvas.style.cursor = getRotatedCursor(handle.type, deg);
            return true;
        }
    }

    return false;
}

function getRotatedCursor(type, deg) {
    // Normalize angle
    deg = ((deg % 360) + 360) % 360;

    // Cursor mapping matrix (rotate handle type)
    const map = {
        0:    { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize', w: 'w-resize', e: 'e-resize' },
        90:   { nw: 'ne-resize', ne: 'se-resize', sw: 'nw-resize', se: 'sw-resize', w: 'n-resize', e: 's-resize' },
        180:  { nw: 'se-resize', ne: 'sw-resize', sw: 'ne-resize', se: 'nw-resize', w: 'e-resize', e: 'w-resize' },
        270:  { nw: 'sw-resize', ne: 'nw-resize', sw: 'se-resize', se: 'ne-resize', w: 's-resize', e: 'n-resize' }
    };

    const nearest = [0, 90, 180, 270].reduce((prev, curr) => {
        return Math.abs(curr - deg) < Math.abs(prev - deg) ? curr : prev;
    });

    return map[nearest][type] || 'default';
}


function handleResize(dx, dy) {
    const selectedImage = images.find(img => img.selected);
    if (!selectedImage) return;

    const minSize = CONFIG.MIN_IMAGE_SIZE * CONFIG.CANVAS_SCALE;

    // Transform mouse dx/dy based on image rotation
    const angle = selectedImage.rotation * Math.PI / 180;
    const transformedDX = dx * Math.cos(angle) + dy * Math.sin(angle);
    // const transformedDY = dy * Math.cos(angle) - dx * Math.sin(angle); // Not needed now

    // Use transformedDX as intended drag direction
    let delta = transformedDX;

    // Adjust direction based on handle position
    if (['nw', 'sw', 'w'].includes(currentHandle)) {
        delta = -transformedDX;
    }

    let newWidth = Math.max(minSize, selectedImage.width + delta);
    let newHeight = newWidth / selectedImage.aspectRatio;

    const centerX = selectedImage.x + selectedImage.width / 2;
    const centerY = selectedImage.y + selectedImage.height / 2;

    selectedImage.width = newWidth;
    selectedImage.height = newHeight;

    selectedImage.x = centerX - newWidth / 2;
    selectedImage.y = centerY - newHeight / 2;

    selectedImage.clampInsideCanvas(); // ← added here
}

function duplicateSelected() {
    const newImages = [];
    images.filter(img => img.selected).forEach(img => {
        const newImage = new ImageObject(
            img.src,
            img.x + 20,
            img.y + 20,
            img.width,
            img.height,
            true // skip default resizing
        );
        newImage.rotation = img.rotation;
        newImage.aspectRatio = img.aspectRatio;
        newImage.selected = true;
        newImage.originalWidth = img.width;
        newImage.originalHeight = img.height;

        newImages.push(newImage);
    });

    images.forEach(img => img.selected = false);
    newImages.forEach(img => images.push(img));
    updatePreviewPanel();
    draw();
}


function rotateSelected() {
    images.filter(img => img.selected).forEach(img => {
        img.rotation = (img.rotation + 90) % 360;
        img.clampInsideCanvas(); // ← added
    });
    draw();
}

function removeSelected() {
    images = images.filter(img => !img.selected);
    updatePreviewPanel();
    draw();
}

function toggleGrid() {
    snapToGrid = !snapToGrid;
    jQuery('#snapGridBtn').toggleClass('active');
    draw();
}

function setSelectedWidth(widthCm) {
    images.filter(img => img.selected).forEach(img => {
        img.setWidthInCm(widthCm);
    });
	updateResizeSlider(); // ✅ Add this line
    draw();
}

function applyCustomSize() {
    const width = parseFloat(jQuery('#customWidth').val());
    const height = parseFloat(jQuery('#customHeight').val());
    
    if (width > 0 && height > 0) {
        images.filter(img => img.selected).forEach(img => {
            img.setCustomSize(width, height);
            img.clampInsideCanvas(); // ← Add this line
        });
        draw();
        updateSizeDisplay();
    }
}

function exportCanvas(type) {
    // Draw without selection borders
    //draw({ cleanExport: true });
    draw({ hideSelection: true });

    const link = document.createElement('a');
    link.download = `layout.${type}`;
    link.href = canvas.toDataURL(`image/${type}`);
    link.click();

    // Restore normal drawing with selection after export
    draw({ hideSelection: true });
    //draw({ hideSelection: true });
}

function draw(options = {}) {
    const { cleanExport = false } = options;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!cleanExport) {
        //if (snapToGrid) {
        drawGrid();
        //}
    
        // Draw margin boundary only when not exporting
        ctx.strokeStyle = '#ccc';
        ctx.strokeRect(
            CONFIG.MARGIN * CONFIG.CANVAS_SCALE,
            CONFIG.MARGIN * CONFIG.CANVAS_SCALE,
            canvas.width - 2 * CONFIG.MARGIN * CONFIG.CANVAS_SCALE,
            canvas.height - 2 * CONFIG.MARGIN * CONFIG.CANVAS_SCALE
        );
    }

    images.forEach(img => img.draw(ctx, cleanExport));
}
function drawGrid() {
    const gridSize = CONFIG.GRID_SIZE * CONFIG.CANVAS_SCALE;
    const margin = CONFIG.MARGIN * CONFIG.CANVAS_SCALE;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;

    // Vertical grid lines + ruler numbers
    for (let x = margin, cm = 0; x <= canvas.width - margin + 1; x += gridSize, cm++) {
        ctx.moveTo(x, margin);
        ctx.lineTo(x, canvas.height - margin);
    
        // Ruler numbers on top (start from 1)
        ctx.save();
        ctx.fillStyle = '#555';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(cm + 1, x, margin - 5); // Changed here
        ctx.restore();
    }
    
    // Horizontal grid lines + ruler numbers
    for (let y = margin, cm = 0; y <= canvas.height - margin + 1; y += gridSize, cm++) {
        ctx.moveTo(margin, y);
        ctx.lineTo(canvas.width - margin, y);
    
        // Ruler numbers on left (start from 1)
        ctx.save();
        ctx.fillStyle = '#555';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(cm + 1, margin - 5, y + 3); // Changed here
        ctx.restore();
    }
    

    ctx.stroke();

    // Draw margin border clearly
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
        margin,
        margin,
        canvas.width - 2 * margin,
        canvas.height - 2 * margin
    );
}

jQuery(document).ready(function() {
    initCanvas();
});