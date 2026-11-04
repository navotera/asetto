<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/** Thrown while registering Asetto with Ecopa or validating an approval callback. */
class EcopaRegistrationException extends RuntimeException
{
    public function __construct(string $message, private readonly int $status = 422)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
