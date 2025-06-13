(function () {
    const state = {
        selectedImages: [],
        imageCounter: 0,
        isGenerating: false,
        isInitialized: false,
        selectedFormat: 'left' // 默認選擇刑事案件格式
    };

    const init = () => {
        if (state.isInitialized) return;
        state.isInitialized = true;

        const elements = {
            imageInput: document.getElementById('imageInput'),
            generateButton: document.getElementById('generate'),
            imagePreview: document.getElementById('imagePreview')
        };

        if (!Object.values(elements).every(Boolean)) {
            console.error('必要的 DOM 元素未找到');
            return;
        }

        elements.imageInput.addEventListener('change', handleImageSelection);
        elements.generateButton.addEventListener('click', handleGenerateWrapper);
        elements.generateButton.onclick = null;
        elements.generateButton.addEventListener('click', handleGenerateWrapper);
        // 添加 toggle switch 的事件監聽
        const toggleContainer = document.querySelector('.toggle-container');
        const labels = toggleContainer.querySelectorAll('.label');

        labels.forEach(label => {
            label.addEventListener('click', () => {
                const value = label.getAttribute('data-value');
                updateToggleState(value);
            });
        });

        updateToggleState(state.selectedFormat);
        updateCreateButtonState();
        console.log('圖片管理腳本初始化完成');
    };

    // 更新 toggle switch 狀態的函數
    const updateToggleState = (value) => {
        const toggleContainer = document.querySelector('.toggle-container');
        toggleContainer.setAttribute('data-state', value);
        state.selectedFormat = value;

        const labels = toggleContainer.querySelectorAll('.label');
        labels.forEach(label => {
            label.classList.toggle('active', label.getAttribute('data-value') === value);
        });
    };

    // 圖片選擇和處理
    const handleImageSelection = (event) => {
        const files = Array.from(event.target.files);
        showUploadingModal();//上傳中請稍後
        processFiles(files);
        event.target.value = '';
    };

    const processFiles = (files) => {
        console.log("Processing files:", files.length);
        const promises = files.map(file => new Promise((resolve, reject) => {
            // 檢查是否為 HEIC 檔案
            const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif');

            if (isHEIC) {// 轉換 HEIC 檔案
                showConversionModal()
                heic2any({
                    blob: file,
                    toType: "image/jpeg",
                    quality: 0.8
                }).then(convertedBlob => {
                    const reader = new FileReader();
                    hideConversionModal()
                    reader.onload = e => {
                        const img = new Image();
                        img.onload = () => {
                            resolve({
                                id: Date.now() + Math.random(),
                                data: e.target.result,
                                name: file.name.replace(/\.(heic|heif)$/i, '.jpg'),
                                size: convertedBlob.size,
                                width: img.width,
                                height: img.height
                            });
                        };
                        img.onerror = reject;
                        img.src = e.target.result;
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(convertedBlob);
                }).catch(error => {
                    hideConversionModal()
                    console.error('HEIC conversion failed:', error);
                    alert(`HEIC 檔案 "${file.name}" 轉換失敗，請嘗試其他格式的圖片。`);
                    reject(error);
                });
            }
            else {// 處理一般圖片檔案
                const reader = new FileReader();
                reader.onload = e => {
                    const img = new Image();
                    img.onload = () => {
                        // 讀取 EXIF 拍攝日期
                        EXIF.getData(img, function () {
                            let exifDate = EXIF.getTag(this, "DateTimeOriginal");
                            // exifDate 例：2024:06:11 12:34:56
                            let formattedDate = formatExifDate(exifDate); // 這行就夠了
                            resolve({
                                id: Date.now() + Math.random(),
                                data: e.target.result,
                                name: file.name,
                                size: file.size,
                                width: img.width,
                                height: img.height,
                                date: formattedDate // 這裡就會有時:分
                            });
                        });
                    };
                    img.onerror = reject;
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            }
        }));
        Promise.all(promises)
            .then(imageDataArray => {
                console.log("Image data processed:", imageDataArray.length);
                imageDataArray.forEach(handleImageAddition);
                hideUploadingModal();

            })
            .catch(error => {
                hideConversionModal()
                hideUploadingModal();
                console.error('Error processing images:', error);
                alert('處理圖片時發生錯誤，請重試。');
            });
    };

    const handleImageAddition = (imageData) => {
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        if (isDuplicateImage(imageData)) {
            console.log("Duplicate found:", imageData.name);
            if (confirm(`檔案 "${imageData.name}" 已經存在。是否重複新增？`)) {
                addImageToCollection(imageData);
            } else {
                console.log("User chose not to add duplicate image");
            }
        } else {
            addImageToCollection(imageData);
        }
    };

    const isDuplicateImage = (newImage) => {
        return state.selectedImages.some(img =>
            img.name === newImage.name &&
            img.size === newImage.size &&
            img.width === newImage.width &&
            img.height === newImage.height
        );
    };

    const addImageToCollection = (imageData) => {
        state.selectedImages.push(imageData);
        addImageToPreview(imageData, state.selectedImages.length);
        updateCreateButtonState();
        updateDownloadZipButtonState(); // ← 新增這行
        console.log("Image added to collection:", imageData.name);
        console.log("Total images in collection:", state.selectedImages.length);
    };

    const addImageToPreview = (imageData, counter) => {
        const preview = document.getElementById('imagePreview');
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        imageContainer.dataset.id = imageData.id;
        imageContainer.draggable = true;

        const img = document.createElement('img');
        img.src = imageData.data;
        img.alt = imageData.name;
        imageContainer.appendChild(img);

        // 新增：讓新照片套用目前滑桿大小
        const slider = document.getElementById('photoSizeSlider');
        if (slider) {
            img.style.maxWidth = slider.value + 'px';
            img.style.maxHeight = slider.value + 'px';
        }

        const counterElement = document.createElement('div');
        counterElement.className = 'image-counter';
        counterElement.textContent = counter;
        imageContainer.appendChild(counterElement);


        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '×';
        deleteButton.onclick = () => removeImage(imageData.id);
        imageContainer.appendChild(deleteButton);

        preview.appendChild(imageContainer);
        console.log("Image preview added:", imageData.name);
    };

    // 拖曳變更順序func
    const handleImageContainerEvents = (e) => {
        const container = e.target.closest('.image-container');
        if (!container) return;
        switch (e.type) {
            case 'dragstart':
                e.dataTransfer.setData('text/plain', container.dataset.id);
                container.style.opacity = '0.5';
                break;
            case 'dragover':
            case 'dragenter':
                e.preventDefault();
                container.classList.add('drag-over');
                break;
            case 'dragleave':
            case 'drop':
                container.classList.remove('drag-over');
                if (e.type === 'drop') {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text');
                    handleImageDrop(draggedId, container);
                }
                break;
            case 'dragend':
                container.style.opacity = '';
                break;
        }

    };

    const handleImageDrop = (draggedId, dropZone) => {
        const draggedElement = document.querySelector(`.image-container[data-id="${draggedId}"]`);
        if (draggedElement && dropZone && draggedElement !== dropZone) {
            const preview = document.getElementById('imagePreview');
            const allContainers = Array.from(preview.querySelectorAll('.image-container'));
            const draggedIndex = allContainers.indexOf(draggedElement);
            const dropIndex = allContainers.indexOf(dropZone);

            const [movedImage] = state.selectedImages.splice(draggedIndex, 1);
            state.selectedImages.splice(dropIndex, 0, movedImage);

            if (draggedIndex < dropIndex) {
                dropZone.parentNode.insertBefore(draggedElement, dropZone.nextSibling);
            } else {
                dropZone.parentNode.insertBefore(draggedElement, dropZone);
            }

            updateImageOrder();
        }
    };

    const updateImageOrder = () => {
        const preview = document.getElementById('imagePreview');
        const containers = Array.from(preview.querySelectorAll('.image-container'));

        containers.forEach((container, index) => {
            const counter = container.querySelector('.image-counter');
            if (counter) {
                counter.textContent = index + 1;
            }
        });

        state.imageCounter = containers.length;

        console.log("Image order updated. New order:", state.selectedImages.map(img => img.name));
        console.log("Total images after reorder:", state.selectedImages.length);

        updateCreateButtonState();
        updateDownloadZipButtonState(); // ← 新增這行
    };

    const removeImage = (id) => {
        console.log("Removing image with id:", id);
        state.selectedImages = state.selectedImages.filter(img => img.id !== id);
        const imageElement = document.querySelector(`.image-container[data-id="${id}"]`);
        if (imageElement) {
            imageElement.remove();
        }
        updateImageCounters();
        updateCreateButtonState();
        updateDownloadZipButtonState(); // ← 新增這行
        console.log("Image removed. Remaining images:", state.selectedImages.length);

        // Add this block to check if no images are left and re-display the empty state
        if (state.selectedImages.length === 0) {
            const imagePreview = document.getElementById('imagePreview');
            const emptyStateDiv = document.createElement('div');
            emptyStateDiv.className = 'empty-state';
            emptyStateDiv.innerHTML = `<h4 style="color:#5d5d5d;">⛔甩鍋聲明</h4>
                    <p style="font-weight: bold;">這是一個建立照片黏貼表的網頁。</p>
                    <p style="color:#ff7d7d; font-weight: bold;">本網頁仍屬實驗甩鍋階段，不保證功能正常運作，敬請見諒。</p>
                    <hr style="border: none; border-top: 2px dashed #b0b0b0;">
                    <h4 style="color:#5d5d5d;">🔍 點擊左欄下方 " + " 按鈕開始新增照片。</h4>
                    <p>新增照片後，可拖曳照片編號變更順序。</p>
                    <p>輸入左邊相關資訊欄位後，即可下載Word文件(.docx)。</p>
                    <p></p>
                    <hr style="border: none; border-top: 2px dashed #b0b0b0;">
                    <h4 style="color:#5d5d5d;">✒️ 照片黏貼表欄位需求</h4>
                    <ul class="field-info-list">
                        <li>刑事案件：案由、單位、地址、日期及攝影人員。</li>
                        <li>交通事故：日期。</li>
                        <li>交通違規：日期、地址及攝影人員。</li>
                    </ul>
                    <p>交通違規：違規車號、法條、事實及單號等欄位尚未開發</p>
                    <p style=" font-weight: bold;"> 實驗性功能【Auto-fill EXIF：自動導入EXIF中拍攝日期資訊】<br>
                        (LINE下載之照片無此資訊)</p>
                    <hr style="border: none; border-top: 2px dashed #b0b0b0;">
                    <h4 style="color:#5d5d5d;">📦 打包照片功能說明</h4>
                    <p>點擊 "打包照片" 按鈕，照片將依編號重新命名打包成ZIP檔案。</p>
                    <p>【 照片檔名格式："案由"照片黏貼表-編號? 】</code></p>


                    <h4 style="color:#5d5d5d;">🧭 打包照片功能提醒</h4>
                    <p>
                        下載打包照片後，若 Windows " 內建解壓縮工具 " 顯示「檔案有風險」或「檔案損毀」
                        <br>請右鍵點選壓縮檔，選取「內容」啟用「解除封鎖」 或 改用<a href="https://www.7-zip.org/" target="_blank">7-Zip</a>
                        或 WinRAR 解壓縮。
                    </p>`;
            imagePreview.appendChild(emptyStateDiv);
            console.log("No images left, displaying empty state.");
        }
    };

    const updateImageCounters = () => {
        const containers = document.querySelectorAll('.image-container');
        containers.forEach((container, index) => {
            const counter = container.querySelector('.image-counter');
            if (counter) {
                counter.textContent = index + 1;
            }
        });
        state.imageCounter = containers.length;
        console.log("Image counters updated. New count:", state.imageCounter);
    };

    //============================================================================================================================================================

    //============================================================================================================================================================
    // 文檔生成
    const handleGenerateWrapper = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (state.isGenerating) {
            console.log('Generation already in progress');
            return;
        }

        console.log('handleGenerate called');
        state.isGenerating = true;

        try {
            await handleGenerate(); // ← 加 await
        } finally {
            setTimeout(() => {
                state.isGenerating = false;
            }, 1000);
        }
    };

    const handleGenerate = async () => {
        if (state.selectedImages.length === 0) {
            alert('請選擇至少一張圖片。');
            return;
        }
        showLoadingModal();

        // 用 setTimeout 讓 modal 先顯示
        setTimeout(async () => {
            try {
                const docx = window.docx;
                const caseReason = document.getElementById('zipPrefix').value;
                const caseUnit = document.getElementById('caseUni').value;
                const caseAddress = document.getElementById('caseAddress').value;
                const caseDate = document.getElementById('caseDate').value;
                const caseNumber = document.getElementById('caseNumber').value;

                const doc = createDocument(docx, state.selectedFormat, {
                    caseReason,
                    caseUnit,
                    caseAddress,
                    caseDate,
                    caseNumber
                });

                // 用 await 等待產生 blob
                const blob = await docx.Packer.toBlob(doc);

                hideLoadingModal();

                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                const dateString = getFormattedDate();
                const formatNames = {
                    'left': '刑案',
                    'middle': '交通事故',
                    'right': '交通違規'
                };
                link.download = `${formatNames[state.selectedFormat]}照片黏貼表_${dateString}.docx`;
                link.click();

            } catch (error) {
                hideLoadingModal();
                console.error('Error in document generation:', error);
                alert('文件生成過程中出錯，請查看控制台以獲取詳細信息。');
            }
        }, 0);
    };

document.addEventListener('DOMContentLoaded', function () {
    const musicMap = {
        left: 'music1.mp3',    // 刑事案件
        middle: 'music2.mp3',  // 交通事故
        right: 'music3.mp3'    // 交通違規
    };
    const audio = document.getElementById('bgMusic');
     audio.volume = 0.7; // 0~1，這裡是 70% 音量
    document.querySelectorAll('.label').forEach(label => {
        label.addEventListener('click', function () {
            const key = this.getAttribute('data-value');
            if (musicMap[key]) {
                audio.src = musicMap[key];
                audio.play();
            }
        });
    });
});



    // 主要的文檔創建函數
    const createDocument = (docx, format, formData) => {
        const isAutoDate = document.getElementById('dateModeSwitch').checked;
        const manualDate = document.getElementById('caseDate').value;
        let title, createContent;
        switch (format) {
            case 'left':
                title = "刑案照片黏貼表";
                createContent = createCriminalContent;
                break;
            case 'middle':
                title = "非道路交通事故照片黏貼紀錄表";
                createContent = createTrafficAccidentContent;
                break;
            case 'right':
                title = "交通違規逕行舉發照片黏貼表";
                createContent = createTrafficViolationContent;
                break;
            default:
                throw new Error("未知的文檔格式");
        }

        const sections = [{
            properties: {
                compatibility: {
                    // 以下屬性可以提高與舊版 Word 的兼容性
                    doNotExpandShiftReturn: true,
                    doNotBreakWrappedTables: true,
                    doNotSnapToGridInCell: true,
                    doNotWrapTextWithPunct: true,
                    doNotUseEastAsianBreakRules: true,
                },
                page: {
                    margin: {
                        top: docx.convertMillimetersToTwip(26),
                        bottom: docx.convertMillimetersToTwip(10),
                        left: docx.convertMillimetersToTwip(27),
                        right: docx.convertMillimetersToTwip(27)
                    }
                }
            },


            headers: {
                default: new docx.Header({
                    children: [
                        new docx.Paragraph({
                            text: title,
                            alignment: docx.AlignmentType.DISTRIBUTE,
                            style: "Header"
                        }),
                    ],
                }),
            },
            children: createContent(docx, state.selectedImages, formData, isAutoDate, manualDate),
        }];

        // 只為非交通違規文件添加頁腳
        if (format !== 'right') {
            sections[0].footers = {
                default: createDefaultFooter(docx),
            };
        }

        return new docx.Document({
            sections: sections,
            styles: createDocumentStyles(docx),
            compatibility: {
                // 全局兼容性設置
                doNotUseHTMLParagraphAutoSpacing: true,
                doNotUseIndentAsNumberingTabStop: true,
            },
        });
    };


    //====================================刑事案件=========================================================================================
    // 刑案照片內容（保持原有格式）
    const createCriminalContent = (docx, images, formData, isAutoDate, manualDate) => {
        return createImageTables(docx, images, formData, isAutoDate, manualDate);
    };

    //刑案照片內容 
    const createImageTables = (docx, images, formData, isAutoDate, manualDate) => {
        const tables = [];
        for (let i = 0; i < images.length; i += 2) {
            tables.push(createHeaderTable(docx, formData));
            tables.push(...createImageTable(docx, images[i], i + 1, formData, isAutoDate, manualDate));
            if (i + 1 < images.length) {
                tables.push(...createImageTable(docx, images[i + 1], i + 2, formData, isAutoDate, manualDate));
            }
            if (i + 2 < images.length) {
                tables.push(new docx.Paragraph({
                    children: [new docx.PageBreak()]
                }));
            }
        }
        return tables;
    };

    //刑案照片內容 案由 單位
    const createHeaderTable = (docx, formData) => {
        return new docx.Table({
            width: {
                size: 100,
                type: docx.WidthType.PERCENTAGE,
            },
            rows: [
                new docx.TableRow({
                    children: [
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: "案由", style: "Normal" })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({
                                text: formData.caseReason || "",
                                style: "Normal",
                                alignment: docx.AlignmentType.CENTER
                            })],
                            width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            columnSpan: 2,
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: "單位", style: "Normal" })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({
                                text: formData.caseUnit || "",
                                style: "Normal",
                                alignment: docx.AlignmentType.CENTER
                            })],
                            width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            columnSpan: 2,
                        }),
                    ],
                }),
            ],
        });
    };

    //刑案照片內容
    const createImageTable = (docx, image, index, formData, isAutoDate, manualDate) => {
        const dateToShow = isAutoDate ? (image.date || "") : manualDate;
        const imageRatio = image.width / image.height;
        let imageHeight = 350;  // 固定高度為350
        let imageWidth = imageHeight * imageRatio; //寬度=高度*比例

        if (imageWidth >= 580) {
            imageWidth = 580;
            imageHeight = imageWidth / imageRatio;//讓比例太長的照片大小以最大寬度為限去調整高度
        }

        return [
            new docx.Table({
                width: {
                    size: 100,
                    type: docx.WidthType.PERCENTAGE,
                },
                rows: [
                    new docx.TableRow({
                        height: {
                            value: docx.convertMillimetersToTwip(95),
                            rule: docx.HeightRule.EXACT,
                        },
                        children: [
                            new docx.TableCell({
                                children: [
                                    new docx.Paragraph({
                                        children: [
                                            new docx.ImageRun({
                                                data: image.data,
                                                transformation: {
                                                    width: imageWidth,
                                                    height: imageHeight,
                                                },
                                            }),
                                        ],
                                        alignment: docx.AlignmentType.CENTER,
                                        //style: "image-container"
                                    }),
                                ],
                                columnSpan: 6,
                                verticalAlign: docx.VerticalAlign.CENTER,
                            }),
                        ],
                    }),
                    new docx.TableRow({
                        children: [
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: `編號(${index})`, style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "照片日期", style: "Normal" })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: dateToShow, style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                width: { size: 35, type: docx.WidthType.PERCENTAGE },
                                columnSpan: 2,
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "攝影人", style: "Normal" })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: formData.caseNumber || "", style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 20, type: docx.WidthType.PERCENTAGE },
                            }),
                        ],
                    }),
                    new docx.TableRow({
                        children: [
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "攝影地址", style: "Normal" })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: formData.caseAddress || "", style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                columnSpan: 5,
                                width: { size: 85, type: docx.WidthType.PERCENTAGE },
                            }),
                        ],
                    }),
                    new docx.TableRow({
                        children: [
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "說明", style: "Normal" })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "", style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                columnSpan: 5,
                                width: { size: 85, type: docx.WidthType.PERCENTAGE },
                            }),
                        ],
                    }),
                ],
            }),
            new docx.Paragraph({
                text: "",
                style: "Normal",
            }),
        ];
    };

    //====================================交通事故=========================================================================================

    // 交通事故照片內容
    const createTrafficAccidentContent = (docx, images, formData, isAutoDate, manualDate) => {
        const tables = [];
        for (let i = 0; i < images.length; i++) {
            // 添加圖片表格
            tables.push(createTrafficAccidentImageTable(docx, images[i], i + 1, formData, isAutoDate, manualDate));

            // 在每個表格後添加一個空白段落，除非是最後一個表格
            if (i < images.length - 1) {
                tables.push(new docx.Paragraph({ text: "", style: "Normal" }));
            }

            // 每兩張圖片後添加一個分頁符，除非是最後一組
            if ((i + 1) % 2 === 0 && i + 1 < images.length) {
                tables.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
            }
        }
        return tables;
    };

    // 交通事故圖片表格
    const createTrafficAccidentImageTable = (docx, image, index, formData, isAutoDate, manualDate) => {
        const dateToShow = isAutoDate ? (image.date || "") : manualDate;
        const imageRatio = image.width / image.height;
        let imageHeight = 350;  // 固定高度為350
        let imageWidth = imageHeight * imageRatio; //寬度=高度*比例

        if (imageWidth >= 580) {
            imageWidth = 580;
            imageHeight = imageWidth / imageRatio; //讓比例太長的照片大小以最大寬度為限去調整高度
        }

        return new docx.Table({
            width: {
                size: 100,
                type: docx.WidthType.PERCENTAGE,
            },
            rows: [
                new docx.TableRow({
                    height: {
                        value: docx.convertMillimetersToTwip(95),
                        rule: docx.HeightRule.EXACT,
                    },
                    children: [
                        new docx.TableCell({
                            children: [
                                new docx.Paragraph({
                                    children: [
                                        new docx.ImageRun({
                                            data: image.data,
                                            transformation: {
                                                width: imageWidth,
                                                height: imageHeight,
                                            },
                                        }),
                                    ],
                                    alignment: docx.AlignmentType.CENTER,
                                }),
                            ],
                            columnSpan: 6,
                            verticalAlign: docx.VerticalAlign.CENTER,
                        }),
                    ],
                }),
                new docx.TableRow({
                    children: [
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: "攝影日期", style: "Normal" })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: dateToShow, alignment: docx.AlignmentType.LEFT })],
                            width: { size: 55, type: docx.WidthType.PERCENTAGE },
                            columnSpan: 2,
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: "照片編號", style: "Normal" })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: `${index}`, style: "Normal", alignment: docx.AlignmentType.CENTER })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            columnSpan: 2,
                        }),
                    ],
                }),
                new docx.TableRow({
                    children: [
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: "說明", style: "Normal" })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({
                                text: "□道路全景 □車損     □車體擦痕  □機車倒地   □煞車痕  □刮地痕  □拖痕     □道路設施 □人倒地    □人受傷部位 □落土    □碎片    □其他________________",
                                style: "Normal",
                                alignment: docx.AlignmentType.LEFT,
                            })],
                            columnSpan: 5,
                            width: { size: 85, type: docx.WidthType.PERCENTAGE },
                        }),
                    ],
                }),
            ],
        });
    };

    //====================================交通違規=========================================================================================

    // 交通違規照片內容
    const createTrafficViolationContent = (docx, images, formData, isAutoDate, manualDate) => {
        const tables = [];
        for (let i = 0; i < images.length; i += 2) {
            // 添加圖片表格
            tables.push(createTrafficViolationHeaderTable(docx));
            tables.push(...createTrafficViolationImageTable(docx, images[i], i + 1, formData, isAutoDate, manualDate));

            /*// 在每個表格後添加一個空白段落，除非是最後一個表格
            if (i < images.length - 1) {
                tables.push(new docx.Paragraph({ text: "", style: "Normal" }));
            }*/
            if (i + 1 < images.length) {
                tables.push(...createTrafficViolationImageTable(docx, images[i + 1], i + 2, formData, isAutoDate, manualDate));
            }

            // 每兩張圖片後添加一個分頁符，除非是最後一組
            if (i + 2 < images.length) {
                tables.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
            }
        }
        return tables;
    };

    // 交通違規表頭表格
    const createTrafficViolationHeaderTable = (docx, formData) => {
        return new docx.Table({
            width: {
                size: 100,
                type: docx.WidthType.PERCENTAGE,
            },
            rows: [
                new docx.TableRow({
                    children: [
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: "標示單號", style: "Normal" })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },
                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({
                                text: "W",
                                style: "Normal",
                                alignment: docx.AlignmentType.CENTER
                            })],
                            width: { size: 35, type: docx.WidthType.PERCENTAGE },

                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({ text: "舉發單號", style: "Normal" })],
                            width: { size: 15, type: docx.WidthType.PERCENTAGE },


                        }),
                        new docx.TableCell({
                            children: [new docx.Paragraph({
                                text: "Z",
                                style: "Normal",
                                alignment: docx.AlignmentType.CENTER
                            })],
                            width: { size: 35, type: docx.WidthType.PERCENTAGE },

                        }),
                    ],
                }),

            ],
        });
    };

    // 交通違規圖片表格
    const createTrafficViolationImageTable = (docx, image, index, formData, isAutoDate, manualDate) => {
        const dateToShow = isAutoDate ? (image.date || "") : manualDate;
        const imageRatio = image.width / image.height;
        let imageHeight = 350;  // 固定高度為350
        let imageWidth = imageHeight * imageRatio; //寬度=高度*比例

        if (imageWidth >= 580) {
            imageWidth = 580;
            imageHeight = imageWidth / imageRatio; //讓比例太長的照片大小以最大寬度為限去調整高度
        }

        return [
            new docx.Table({
                width: {
                    size: 100,
                    type: docx.WidthType.PERCENTAGE,
                },
                rows: [

                    new docx.TableRow({
                        height: {
                            value: docx.convertMillimetersToTwip(95),
                            rule: docx.HeightRule.EXACT,
                        },
                        children: [
                            new docx.TableCell({
                                children: [
                                    new docx.Paragraph({
                                        children: [
                                            new docx.ImageRun({
                                                data: image.data,
                                                transformation: {
                                                    width: imageWidth,
                                                    height: imageHeight,
                                                },
                                            }),
                                        ],
                                        alignment: docx.AlignmentType.CENTER,
                                    }),
                                ],
                                columnSpan: 6,
                                verticalAlign: docx.VerticalAlign.CENTER,
                            }),
                        ],
                    }),
                    new docx.TableRow({
                        children: [
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "違規時間", style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: dateToShow, alignment: docx.AlignmentType.LEFT })],
                                width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "違規地點", style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: formData.caseAddress || "", style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            }),
                        ],
                    }),
                    new docx.TableRow({

                        children: [
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "違規車號", style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "V", style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "違規法條", style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "第 條 項 款", style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            }),
                        ],
                    }),
                    new docx.TableRow({
                        children: [
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "違規事實", style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "T", style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: "舉發人員", style: "Normal", alignment: docx.AlignmentType.CENTER })],
                                width: { size: 15, type: docx.WidthType.PERCENTAGE },
                            }),
                            new docx.TableCell({
                                children: [new docx.Paragraph({ text: formData.caseNumber || "", style: "Normal", alignment: docx.AlignmentType.LEFT })],
                                width: { size: 35, type: docx.WidthType.PERCENTAGE },
                            }),
                        ],
                    }),
                ],
            }),
            new docx.Paragraph({
                text: "",
                style: "Normal",
            }),
            new docx.Paragraph({
                text: "",
                style: "Normal",
            }),
        ];
    };


    //================================================================================================================================================
    const createDefaultFooter = (docx) => {
        return new docx.Footer({
            children: [new docx.Paragraph({
                children: [
                    new docx.TextRun({
                        text: "第 ",
                        size: 20,
                        font: "DFKai-SB",
                    }),
                    new docx.TextRun({
                        children: [docx.PageNumber.CURRENT],
                        size: 20,
                        font: "DFKai-SB",
                    }),
                    new docx.TextRun({
                        text: " 頁",
                        size: 20,
                        font: "DFKai-SB",
                    }),
                ],
                alignment: docx.AlignmentType.CENTER,
                style: "Footer"
            })],
        });
    };

    const createDocumentStyles = (docx) => {
        return {
            paragraphStyles: [
                {
                    id: "Normal",
                    name: "Normal",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        size: 23,
                        font: "DFKai-SB",
                    },
                    paragraph: {
                        alignment: docx.AlignmentType.DISTRIBUTE
                    },
                },
                {
                    id: "Header",
                    name: "Header",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        size: 44,
                        font: "DFKai-SB",
                    },
                },
            ],
        };
    };

    const updateCreateButtonState = () => {
        const createButton = document.getElementById('generate');
        if (!createButton) {
            console.error('Create button not found');
            return;
        }
        const isEnabled = state.selectedImages.length > 0;

        createButton.classList.toggle('create-btn-disabled', !isEnabled);
        createButton.classList.toggle('create-btn-enabled', isEnabled);

        console.log("Create button state updated. Enabled:", isEnabled);
        console.log("Selected images count:", state.selectedImages.length);
    };

    let uploadingModalShowTime = 0;

    const showUploadingModal = () => {
        document.getElementById('uploadingModal').style.display = 'block';
        uploadingModalShowTime = Date.now();
    };

    const hideUploadingModal = () => {
        const elapsed = Date.now() - uploadingModalShowTime;
        const minDuration = 500; // 至少顯示0.4秒
        if (elapsed < minDuration) {
            setTimeout(() => {
                document.getElementById('uploadingModal').style.display = 'none';
            }, minDuration - elapsed);
        } else {
            document.getElementById('uploadingModal').style.display = 'none';
        }
    };

    const showLoadingModal = () => {
        document.getElementById('loadingModal').style.display = 'block';
    };

    const hideLoadingModal = () => {
        document.getElementById('loadingModal').style.display = 'none';
    };

    const showConversionModal = () => {
        document.getElementById('conversionModal').style.display = 'block';
    };

    const hideConversionModal = () => {
        document.getElementById('conversionModal').style.display = 'none';
    };

    const getFormattedDate = () => {
        const now = new Date();
        return (now.getFullYear() - 1911) +
            ('0' + (now.getMonth() + 1)).slice(-2) +
            ('0' + now.getDate()).slice(-2) + '_' +
            ('0' + now.getHours()).slice(-2) +
            ('0' + now.getMinutes()).slice(-2);
    };

    // 事件監聽器設置
    const setupEventListeners = () => {
        const imagePreview = document.getElementById('imagePreview');
        ['dragstart', 'dragover', 'dragenter', 'dragleave', 'drop', 'dragend'].forEach(eventName => {
            imagePreview.addEventListener(eventName, handleImageContainerEvents);
        });
        // 全局錯誤處理
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
            alert('發生了意外錯誤。請重新加載頁面並重試。如果問題持續存在，請聯繫支持團隊。');
        });
    };

    // 初始化
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('fabAddPhoto').addEventListener('click', function () {
            document.getElementById('imageInput').click();
        });
        init();
        setupEventListeners();

    });

    document.addEventListener('DOMContentLoaded', function () {
        const slider = document.getElementById('photoSizeSlider');
        slider.addEventListener('input', function () {
            const imgs = document.querySelectorAll('.image-container img');
            imgs.forEach(img => {
                img.style.maxWidth = slider.value + 'px';
                img.style.maxHeight = slider.value + 'px';
            });
        });
    });


    document.addEventListener('DOMContentLoaded', function () {
        const dateSwitch = document.getElementById('dateModeSwitch');
        const dateInput = document.getElementById('caseDate');
        const dateModeLabel = document.getElementById('dateModeLabel');

        function setDateInputMode() {
            if (dateSwitch.checked) {
                dateInput.disabled = true;
                dateModeLabel.textContent = 'Auto-fill EXIF';
                // 這裡可以自動帶入第一張照片的 EXIF 日期
                if (window.firstExifDate) {
                    dateInput.value = window.firstExifDate;
                } else {
                    dateInput.value = '';
                }
            } else {
                dateInput.disabled = false;
               dateModeLabel.textContent = '';
            }
        }

        dateSwitch.addEventListener('change', setDateInputMode);

        setDateInputMode();
    });

    function formatExifDate(exifDate) {
        // exifDate 例：2024:06:11 14:23:45
        if (!exifDate) return '';
        const [datePart, timePart] = exifDate.split(' ');
        if (!datePart || !timePart) return '';
        const [y, m, d] = datePart.split(':');
        const year = parseInt(y, 10) - 1911;
        const [hh, mm] = timePart.split(':');
        return `${year}/${m}/${d} ${hh}:${mm}`;
    }




    document.getElementById('downloadZip').addEventListener('click', async () => {
        if (!state.selectedImages.length) {
            alert('目前沒有可下載打包的照片！');
            return;
        }

        // 顯示「照片打包中」modal
        document.getElementById('zippingModal').style.display = 'block';

        setTimeout(async () => {
            try {
                const zip = new JSZip();
                const prefixInput = document.getElementById('zipPrefix');
                const prefix = prefixInput ? prefixInput.value.trim() : '';
                for (let i = 0; i < state.selectedImages.length; i++) {
                    const img = state.selectedImages[i];
                    const ext = img.name.split('.').pop();
                    const newName = `${prefix}照片黏貼表-編號${i + 1}.${ext}`;
                    const data = img.data.split(',')[1];
                    zip.file(newName, data, { base64: true });
                }
                const content = await zip.generateAsync({ type: "blob" });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(content);
                a.download = `${prefix}照片打包下載.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } finally {
                document.getElementById('zippingModal').style.display = 'none';
            }
        }, 0);
    });

    function updateDownloadZipButtonState() {
        const btn = document.getElementById('downloadZip');
        if (state.selectedImages.length > 0) {
            btn.classList.remove('downzip-btn-disabled');
            btn.classList.add('downzip-btn-enabled');
        } else {
            btn.classList.add('downzip-btn-disabled');
            btn.classList.remove('downzip-btn-enabled');
        }
    }
    window.onbeforeunload = function (e) { /*離開網頁提醒*/
        const hasInput =
            document.getElementById('zipPrefix').value.trim() ||
            document.getElementById('caseUni').value.trim() ||
            document.getElementById('caseAddress').value.trim() ||
            document.getElementById('caseDate').value.trim() ||
            document.getElementById('caseNumber').value.trim() ||
            (state.selectedImages && state.selectedImages.length > 0);

        if (hasInput) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }

    };
})(); // IIFE 結束

