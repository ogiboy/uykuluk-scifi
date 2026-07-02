"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { type RunQueueDensity, runQueueDensityValues } from "@/lib/runQueueWorkbench";

export const maxBlockedActionSliderValue = 5;

type RunQueueTunePopoverProps = Readonly<{
  density: RunQueueDensity;
  highestBlockedActionCount: number;
  maxBlockedActions: number;
  onDensityChange: (density: RunQueueDensity) => void;
  onMaxBlockedActionsChange: (value: number) => void;
}>;

const densityLabels = {
  compact: "Compact",
  comfortable: "Comfortable",
} as const satisfies Record<RunQueueDensity, string>;

/**
 * Renders read-only queue display tuning controls for the Studio run workbench.
 *
 * @param density - Current table density.
 * @param highestBlockedActionCount - Highest blocker count in the current queue data.
 * @param maxBlockedActions - Current blocker limit slider value.
 * @param onDensityChange - Callback used when the operator changes table density.
 * @param onMaxBlockedActionsChange - Callback used when the operator changes blocker limit.
 */
export function RunQueueTunePopover({
  density,
  highestBlockedActionCount,
  maxBlockedActions,
  onDensityChange,
  onMaxBlockedActionsChange,
}: RunQueueTunePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className='queue-tune-button' type='button' variant='secondary'>
          Tune review surface
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='queue-tune-popover'>
        <div className='queue-tune-stack'>
          <div>
            <h3>Review surface</h3>
            <p>Local projection only. These controls never approve, render, upload, or mutate.</p>
          </div>
          <div className='queue-slider-control'>
            <div className='queue-slider-header'>
              <Label htmlFor='max-blocked-actions'>Max blockers shown</Label>
              <strong>{maxBlockedActions}</strong>
            </div>
            <Slider
              id='max-blocked-actions'
              min={0}
              max={maxBlockedActionSliderValue}
              step={1}
              value={[maxBlockedActions]}
              onValueChange={(value) => onMaxBlockedActionsChange(value[0] ?? 0)}
            />
            <small>
              Current data reaches {highestBlockedActionCount}. Set 0 to review only fully unblocked
              runs.
            </small>
          </div>
          <div className='queue-density-control'>
            <Label id='queue-density-label'>Table density</Label>
            <RadioGroup
              aria-labelledby='queue-density-label'
              className='queue-density-options'
              value={density}
              onValueChange={(value) => setSelectedDensity(value, onDensityChange)}
            >
              {runQueueDensityValues.map((value) => (
                <label className='queue-density-option' key={value}>
                  <RadioGroupItem value={value} />
                  <span>{densityLabels[value]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function setSelectedDensity(value: string, setDensity: (density: RunQueueDensity) => void): void {
  if (runQueueDensityValues.includes(value as RunQueueDensity)) {
    setDensity(value as RunQueueDensity);
  }
}
