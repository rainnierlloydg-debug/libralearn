<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LibrarySettingsController extends Controller
{
    public function show()
    {
        return response()->json([
            'success' => true,
            'data' => $this->current(),
        ]);
    }

    public function update(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'fine_per_day' => 'required_without_all:library_name,library_email,library_phone,library_address|numeric|min:0|max:1000',
            'library_name' => 'sometimes|required|string|max:255',
            'library_email' => 'sometimes|nullable|email|max:255',
            'library_phone' => 'sometimes|nullable|string|max:50',
            'library_address' => 'sometimes|nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($validator->validated() as $key => $value) {
            Setting::setValue($key, $key === 'fine_per_day' ? (string) round((float) $value, 2) : $value);
        }

        return response()->json([
            'success' => true,
            'message' => 'Settings saved',
            'data' => $this->current(),
        ]);
    }

    private function current(): array
    {
        return [
            'fine_per_day' => Setting::finePerDay(),
            'library_name' => Setting::getValue('library_name', config('library.school_name') . ' Library'),
            'library_email' => Setting::getValue('library_email', ''),
            'library_phone' => Setting::getValue('library_phone', ''),
            'library_address' => Setting::getValue('library_address', ''),
            // Read-only loan rules from config/library.php, shown for reference.
            'loan_days' => (int) config('library.loan_days'),
            'max_active_loans' => (int) config('library.max_active_loans'),
            'max_renewals' => (int) config('library.max_renewals'),
            'renewal_days' => (int) config('library.renewal_days'),
        ];
    }
}
