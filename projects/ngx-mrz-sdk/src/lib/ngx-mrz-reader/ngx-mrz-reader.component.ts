import { Component, EventEmitter, OnInit, Output, Input } from '@angular/core';
import { LabelRecognizer } from 'dynamsoft-label-recognizer';
import { OverlayManager } from '../overlay';
import { MrzParser } from '../parser';

@Component({
  selector: 'ngx-mrz-reader',
  templateUrl: './ngx-mrz-reader.component.html',
  styleUrls: ['./ngx-mrz-reader.component.css'],
})
export class NgxMrzReaderComponent implements OnInit {
  @Input() showOverlay: boolean;
  isLoaded = false;
  overlay: HTMLCanvasElement | undefined;
  context: CanvasRenderingContext2D | undefined;
  reader: LabelRecognizer | undefined;
  overlayManager: OverlayManager;

  @Output() result = new EventEmitter<any>();

  constructor() {
    this.overlayManager = new OverlayManager();
    this.showOverlay = true;
   }

  ngOnInit(): void {
    this.overlayManager.initOverlay(document.getElementById('overlay') as HTMLCanvasElement);
    (async () => {
      LabelRecognizer.onResourcesLoaded = (resourcePath) => {
        this.isLoaded = true;
      };
      this.reader = await LabelRecognizer.createInstance();
      await this.reader.updateRuntimeSettingsFromString("MRZ");
    })();
  }

  onChange(event: Event) {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    if (fileList) {
      let file = fileList.item(0) as any;
      if (file) {
        let fr = new FileReader();
        fr.onload = (event: any) => {
          let image = document.getElementById('image') as HTMLImageElement;
          if (image) {
            image.src = event.target.result;
            const img = new Image();

            img.onload = (event: any) => {
              this.overlayManager.updateOverlay(img.width, img.height);
              if (this.reader) {
                // We will try 4 angles. Normal direction, turn left 90 degrees, turn right 90 degrees, turn 180 degrees.
                (async()=>{
                  try{
                    // Reset to normal direction
                    await this.reader!.updateRuntimeSettingsFromString("MRZ");
                    let results = await this.reader!.recognize(file);
                    let runtimeSettings;
                    if(!results.length){
                      runtimeSettings = JSON.parse(await this.reader!.outputRuntimeSettingsToString());
                      // Turn left 90 degrees
                      runtimeSettings.ReferenceRegionArray[0].Localization.FirstPoint = [0,100];
                      runtimeSettings.ReferenceRegionArray[0].Localization.SecondPoint = [0,0];
                      runtimeSettings.ReferenceRegionArray[0].Localization.ThirdPoint = [100,0];
                      runtimeSettings.ReferenceRegionArray[0].Localization.FourthPoint = [100,100];
                      await this.reader!.updateRuntimeSettingsFromString(JSON.stringify(runtimeSettings));
                      results = await this.reader!.recognize(file);
                    }
                    if(!results.length){
                      // Turn right 90 degrees
                      runtimeSettings.ReferenceRegionArray[0].Localization.FirstPoint = [100,0];
                      runtimeSettings.ReferenceRegionArray[0].Localization.SecondPoint = [100,100];
                      runtimeSettings.ReferenceRegionArray[0].Localization.ThirdPoint = [0,100];
                      runtimeSettings.ReferenceRegionArray[0].Localization.FourthPoint = [0,0];
                      await this.reader!.updateRuntimeSettingsFromString(JSON.stringify(runtimeSettings));
                      results = await this.reader!.recognize(file);
                    }
                    if(!results.length){
                      // Turn 180 degrees
                      runtimeSettings.ReferenceRegionArray[0].Localization.FirstPoint = [100,100];
                      runtimeSettings.ReferenceRegionArray[0].Localization.SecondPoint = [0,100];
                      runtimeSettings.ReferenceRegionArray[0].Localization.ThirdPoint = [0,0];
                      runtimeSettings.ReferenceRegionArray[0].Localization.FourthPoint = [100,0];
                      await this.reader!.updateRuntimeSettingsFromString(JSON.stringify(runtimeSettings));
                      results = await this.reader!.recognize(file);
                    }
                    // handle final results
                    let txts: any = [];
                    if (results.length > 0) {
                      for (let result of results) {
                        for (let line of result.lineResults) {
                            txts.push(line.text);
                            if (this.showOverlay) this.overlayManager.drawOverlay(line.location.points, line.text);
                        }
                      }
                      
                      let parsedResults = "";
                      if (txts.length == 2) {
                        parsedResults = MrzParser.parseTwoLines(txts[0], txts[1]) || MrzParser.parseTwoLines(txts[1], txts[0]);
                      }
                      else if (txts.length == 3) {
                        parsedResults = MrzParser.parseThreeLines(txts[0], txts[1], txts[2]) || MrzParser.parseThreeLines(txts[2], txts[1], txts[0]);
                      }
                      this.result.emit([txts.join('\n'), parsedResults]);
                    } else {
                      this.result.emit(txts.join(''));
                    }
                  }catch(e){
                    alert(e);
                  }
                })();
              }
            };
            img.src = event.target.result;
          }
        };
        fr.readAsDataURL(file);
      }
    }
  }

}
