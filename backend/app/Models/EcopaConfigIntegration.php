<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Key/value store for Asetto's Ecopa integration state and (encrypted) SSO +
 * webhook credentials, received through the first-access approval callback.
 * Secrets are stored encrypted and never exposed through the status API.
 */
class EcopaConfigIntegration extends Model
{
    protected $table = 'ecopa_config_integration';

    public $timestamps = false;

    protected $fillable = ['name', 'value'];
}
