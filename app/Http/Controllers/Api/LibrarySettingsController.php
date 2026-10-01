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
            'fine_per_day' => 'required|numeric|min:0|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        Setting::setValue('fine_per_day', (string) round((float) $request->fine_per_day, 2));

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
            // Read-only loan rules from config/library.php, shown for reference.
            'loan_days' => (int) config('library.loan_days'),
            'max_active_loans' => (int) config('library.max_active_loans'),
            'max_renewals' => (int) config('library.max_renewals'),
            'renewal_days' => (int) config('library.renewal_days'),
        ];
    }
}
