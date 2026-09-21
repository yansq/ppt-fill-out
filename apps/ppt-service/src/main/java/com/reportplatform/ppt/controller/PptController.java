package com.reportplatform.ppt.controller;

import com.reportplatform.ppt.model.ParseRequest;
import com.reportplatform.ppt.model.ParseResponse;
import com.reportplatform.ppt.model.RenderRequest;
import com.reportplatform.ppt.model.RenderResponse;
import com.reportplatform.ppt.parser.PptParserService;
import com.reportplatform.ppt.renderer.PptRenderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
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
}
