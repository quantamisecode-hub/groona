import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactQuill from 'react-quill';
import { debounce } from "lodash";

export default function SectionEditor({ value: initialValue, onChange, className, modules, ...props }) {
    const [value, setValue] = useState(initialValue || '');
    const lastSavedValue = useRef(initialValue || '');

    useEffect(() => {
        // Same logic as DebouncedInput
        if (initialValue !== value && initialValue !== lastSavedValue.current) {
            setValue(initialValue || '');
            lastSavedValue.current = initialValue || '';
        }
    }, [initialValue]);

    const debouncedSave = useCallback(
        debounce((val) => {
            lastSavedValue.current = val;
            onChange(val);
        }, 1500),
        [onChange]
    );

    const handleChange = (val) => {
        setValue(val);
        debouncedSave(val);
    };

    return (
        <ReactQuill
            {...props}
            theme="snow"
            value={value}
            onChange={handleChange}
            className={className}
            modules={modules}
        />
    );
}