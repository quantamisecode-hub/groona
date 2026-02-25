import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { debounce } from "lodash";

export default function DebouncedInput({ value: initialValue, onChange, className, ...props }) {
    const [value, setValue] = useState(initialValue);
    const lastSavedValue = useRef(initialValue);

    useEffect(() => {
        // Only update from prop if it's different from what we have 
        // AND different from what we last saved (to avoid overwriting user typing with their own save echo)
        // OR if the prop value matches what we last saved (confirmation), we don't need to change local value
        // BUT if external change happened (AI or other user), prop will differ from lastSaved.
        
        if (initialValue !== value && initialValue !== lastSavedValue.current) {
            setValue(initialValue);
            lastSavedValue.current = initialValue;
        }
    }, [initialValue]);

    const debouncedSave = useCallback(
        debounce((val) => {
            lastSavedValue.current = val;
            onChange(val);
        }, 1000),
        [onChange]
    );

    const handleChange = (e) => {
        const val = e.target.value;
        setValue(val);
        debouncedSave(val);
    };

    return (
        <Input
            {...props}
            value={value}
            onChange={handleChange}
            className={className}
        />
    );
}