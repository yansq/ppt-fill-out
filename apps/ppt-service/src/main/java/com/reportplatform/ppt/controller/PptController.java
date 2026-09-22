package com.reportplatform.ppt.controller;

import com.reportplatform.ppt.model.ParseRequest;
import com.reportplatform.ppt.model.ParseResponse;
import com.reportplatform.ppt.model.DraftPreviewRequest;
import com.reportplatform.ppt.model.GenerateRequest;
import com.reportplatform.ppt.model.GenerateResponse;
import com.reportplatform.ppt.model.RenderRequest;
import com.reportplatform.ppt.model.RenderResponse;
import com.reportplatform.ppt.model.StaticPreviewRequest;
import com.reportplatform.ppt.parser.PptParserService;
import com.reportplatform.ppt.renderer.PptRenderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ppt")
public class PptController {

    private final PptParserService parserService;
    private final PptRenderService renderService;

    public PptController(PptParserService parserService, PptRenderService renderService) {
        this.parserService = parserService;
        this.renderService = renderService;
    }

    @PostMapping("/parse")
    public ResponseEntity<ParseResponse> parse(@Valid @RequestBody ParseRequest request) {
        return ResponseEntity.ok(parserService.parse(request));
    }

    @PostMapping("/render")
    public ResponseEntity<RenderResponse> render(@Valid @RequestBody RenderRequest request) {
        return ResponseEntity.ok(renderService.render(request));
    }

    @PostMapping(value = "/render-static", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> renderStatic(@Valid @RequestBody StaticPreviewRequest request) {
        return ResponseEntity.ok(renderService.renderStaticPreview(request));
    }

    @PostMapping(value = "/render-draft", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> renderDraft(@Valid @RequestBody DraftPreviewRequest request) {
        return ResponseEntity.ok(renderService.renderDraftPreview(request));
    }

    @PostMapping("/generate")
    public ResponseEntity<GenerateResponse> generate(@Valid @RequestBody GenerateRequest request) {
        return ResponseEntity.ok(renderService.generate(request));
    }
}
